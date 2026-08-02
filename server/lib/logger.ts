// 本地 logger 替代 @lark-apaas/client-toolkit-lite 的 logger
// 避免在本地开发环境中加载该包的虚拟模块依赖

type LogFn = (...args: any[]) => void;

function format(level: string, args: any[]): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;
}

export const logger: { info: LogFn; error: LogFn; warn: LogFn; debug: LogFn } = {
  info: (...args) => console.log(format('INFO', args)),
  error: (...args) => console.error(format('ERROR', args)),
  warn: (...args) => console.warn(format('WARN', args)),
  debug: (...args) => console.debug(format('DEBUG', args)),
};
