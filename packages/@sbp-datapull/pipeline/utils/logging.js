const { LOG_LEVEL = 'ERROR' } = process.env

const setLogLevel = (logLevel) => {
  const nullFn = ()=> null;

  if(logLevel=='ERROR'){
    console.warn = nullFn;
    console.info = nullFn;
    console.debug = nullFn;
  } else if(logLevel=='INFO'){
    console.debug = nullFn;
  } else if(logLevel=='WARN'){
    console.info = nullFn;
    console.debug = nullFn;
  }

}

setLogLevel(LOG_LEVEL)
