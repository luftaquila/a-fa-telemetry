/*
 * logger.c
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */


#include "logger.h"
#include "sdio.h"
#include "i2c.h"

extern LOG syslog;

inline int SYS_LOG(LOG_LEVEL level, LOG_SOURCE source, int key) {
  syslog.timestamp = HAL_GetTick();
  syslog.level = level;
  syslog.source = source;
  syslog.key = key;

  SD_WRITE();
  // HAL_I2C_Master_Transmit_IT(&hi2c1, ESP_I2C_ADDR, (uint8_t *)&syslog, 16 /* sizeof(LOG) */);

  return 0;
}
