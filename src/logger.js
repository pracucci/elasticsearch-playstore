const pino = require("pino");

let logger = {};

const initLoggerFromConfig = (config) => {
    let instance = pino({
        level:       config.logLevel,
        prettyPrint: config.logFormat !== "json",
        messageKey:  "message"
    });

    logger.debug = instance.debug.bind(instance);
    logger.info  = instance.info.bind(instance);
    logger.error = instance.error.bind(instance);
    logger.fatal = instance.fatal.bind(instance);

    return logger;
}

const getLogger = () => {
    return logger;
};

module.exports = {
    initLoggerFromConfig: initLoggerFromConfig,
    getLogger:            getLogger
};
