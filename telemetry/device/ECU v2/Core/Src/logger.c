/*
 * logger.c
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */


#include "logger.h"
#include "sdio.h"
#include "i2c.h"

extern LOG log_data;

inline int SYS_LOG() {
  SD_WRITE();

  // i2c transmit
  HAL_I2C_Master_Transmit_IT(&hi2c1, ESP_I2C_ADDR, (uint8_t *)&log_data, 16 /* sizeof(LOG) */);

  return 0;
}
