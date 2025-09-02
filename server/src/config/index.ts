export interface ServerConfig {
  port: number;
  corsOrigin: string;
}

export const defaultConfig: ServerConfig = {
  port: 3000,
  corsOrigin: '*'
};