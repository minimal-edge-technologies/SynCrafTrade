// src/utils/trading.js
export const checkTradingHours = (tradingHours) => {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    return currentTime >= tradingHours.start && currentTime <= tradingHours.end;
  };