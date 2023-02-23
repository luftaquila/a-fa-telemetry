/*
 * logger.c
 *
 *  Created on: Feb 22, 2023
 *      Author: LUFT-AQUILA
 */


#include "sdio.h"

int32_t SYS_LOG(LOG_LEVEL level, LOG_SOURCE source, int32_t key) {
  syslog.timestamp = HAL_GetTick();
  syslog.level = level;
  syslog.source = source;
  syslog.key = key;

  SD_WRITE();
  // HAL_I2C_Master_Transmit_IT(&hi2c1, ESP_I2C_ADDR, (uint8_t *)&syslog, 16 /* sizeof(LOG) */);

  #ifdef DEBUG_LOG
    printf("[%8lu] [LOG] level: %d  source: %d  key: %d  value: 0x %02x %02x %02x %02x %02x %02x %02x %02x\r\n", syslog.timestamp, syslog.level, syslog.source, syslog.key, syslog.value[7], syslog.value[6], syslog.value[5], syslog.value[4], syslog.value[3], syslog.value[2], syslog.value[1], syslog.value[0]);
  #endif

  // reset log value
  *(uint64_t *)syslog.value = 0;

  return 0;
}
