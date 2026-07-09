export class Logger {
  constructor(prefix = 'kore-fingerprint') {
    this.prefix = prefix;
  }

  _log(level, message) {
    const ts = new Date().toISOString();
    process.stderr.write('[' + ts + '] [' + this.prefix + '] [' + level + '] ' + message + '\n');
  }

  info(msg)  { this._log('INFO',  msg); }
  warn(msg)  { this._log('WARN',  msg); }
  error(msg) { this._log('ERROR', msg); }
  debug(msg) { this._log('DEBUG', msg); }
}
