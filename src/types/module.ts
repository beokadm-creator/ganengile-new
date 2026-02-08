/**
 * Module System Core Types
 * 모듈 시스템의 핵심 인터페이스와 상태 정의
 */

export enum ModuleStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}

export interface Module {
  readonly name: string;
  readonly version: string;
  
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  on(event: string, handler: Function): void;
  emit(event: string, data: any): void;
  
  getStatus(): ModuleStatus;
}

export interface ModuleConfig {
  enabled: boolean;
  priority: number;
  dependencies?: string[];
}
