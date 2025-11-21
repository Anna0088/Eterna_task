/**
 * Monitoring Service
 *
 * Provides comprehensive system monitoring including:
 * - System health checks
 * - Performance metrics
 * - Resource utilization
 * - Trading mode detection
 * - Solana connectivity (if Real Mode)
 */

import mongoose from 'mongoose';
import { config } from '../config';
import { getQueueMetrics } from '../queue';
import { getSolanaConnection } from '../config/solana';
import { createRedisConnection } from '../config/redis';

const redisClient = createRedisConnection();

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  uptime: number;
  mode: 'mock' | 'real';
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queue: ComponentHealth;
    solana?: ComponentHealth;
  };
  metrics: SystemMetrics;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentUsed: number;
  };
  cpu: {
    usage: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  };
}

export class MonitoringService {
  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const [databaseHealth, redisHealth, queueHealth, solanaHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkQueueHealth(),
      config.trading.mockMode ? Promise.resolve(null) : this.checkSolanaHealth(),
    ]);

    const metrics = await this.collectMetrics();

    // Determine overall status
    const componentStatuses = [
      databaseHealth.status,
      redisHealth.status,
      queueHealth.status,
      solanaHealth?.status,
    ].filter(Boolean);

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (componentStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.env,
      uptime: process.uptime(),
      mode: config.trading.mockMode ? 'mock' : 'real',
      components: {
        database: databaseHealth,
        redis: redisHealth,
        queue: queueHealth,
        ...(solanaHealth && { solana: solanaHealth }),
      },
      metrics,
    };
  }

  /**
   * Check database connectivity and health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const state = mongoose.connection.readyState;

      if (state === 1) {
        return {
          status: 'healthy',
          message: 'Connected',
          details: {
            state: 'connected',
            host: mongoose.connection.host,
            name: mongoose.connection.name,
          },
        };
      } else if (state === 2) {
        return {
          status: 'degraded',
          message: 'Connecting',
          details: { state: 'connecting' },
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Disconnected',
          details: { state: 'disconnected' },
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Redis connectivity and health
   */
  private async checkRedisHealth(): Promise<ComponentHealth> {
    try {
      const pong = await redisClient.ping();

      if (pong === 'PONG') {
        const info = await redisClient.info('stats');
        return {
          status: 'healthy',
          message: 'Connected',
          details: {
            connected: true,
            stats: this.parseRedisInfo(info),
          },
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Ping failed',
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check queue health and metrics
   */
  private async checkQueueHealth(): Promise<ComponentHealth> {
    try {
      const metrics = await getQueueMetrics();

      const failureRate = metrics.total > 0 ? (metrics.failed / metrics.total) * 100 : 0;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Queue operational';

      if (failureRate > 20) {
        status = 'unhealthy';
        message = `High failure rate: ${failureRate.toFixed(1)}%`;
      } else if (failureRate > 10) {
        status = 'degraded';
        message = `Elevated failure rate: ${failureRate.toFixed(1)}%`;
      }

      return {
        status,
        message,
        details: metrics,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Solana connectivity (Real Mode only)
   */
  private async checkSolanaHealth(): Promise<ComponentHealth> {
    try {
      const connection = getSolanaConnection();
      const slot = await connection.getSlot();

      if (slot > 0) {
        const version = await connection.getVersion();
        const network = process.env.SOLANA_NETWORK || 'devnet';
        return {
          status: 'healthy',
          message: 'Connected to Solana RPC',
          details: {
            network: network,
            rpcUrl: config.solana?.rpcUrl || 'unknown',
            currentSlot: slot,
            version: version['solana-core'],
          },
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Invalid slot received',
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<SystemMetrics> {
    const queueMetrics = await getQueueMetrics();
    const memUsage = process.memoryUsage();

    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // seconds
      },
      queue: queueMetrics,
    };
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const stats: Record<string, string> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key.trim()] = value.trim();
        }
      }
    }

    return stats;
  }

  /**
   * Get trading mode information
   */
  getModeInfo() {
    const network = process.env.SOLANA_NETWORK || 'devnet';
    return {
      mode: config.trading.mockMode ? 'mock' : 'real',
      description: config.trading.mockMode
        ? 'Simulated trading without blockchain'
        : 'Real Solana devnet/mainnet integration',
      configuration: config.trading.mockMode
        ? {
            supportedPairs: config.trading.supportedPairs,
            defaultSlippage: config.trading.defaultSlippage,
          }
        : {
            supportedPairs: config.trading.supportedPairs,
            defaultSlippage: config.trading.defaultSlippage,
            solanaNetwork: network,
            solanaRPC: config.solana?.rpcUrl,
          },
    };
  }

  /**
   * Get performance metrics for monitoring dashboards
   */
  async getPerformanceMetrics() {
    const queueMetrics = await getQueueMetrics();
    const memUsage = process.memoryUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      queue: {
        throughput: {
          completed: queueMetrics.completed,
          failed: queueMetrics.failed,
          successRate: queueMetrics.total > 0
            ? ((queueMetrics.completed / queueMetrics.total) * 100).toFixed(2) + '%'
            : 'N/A',
        },
        current: {
          waiting: queueMetrics.waiting,
          active: queueMetrics.active,
          delayed: queueMetrics.delayed,
        },
      },
    };
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
