/*
 * logger.h
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */

#ifndef INC_LOGGER_H_
#define INC_LOGGER_H_

#include "stdio.h"
#include "sdio.h"

//#define DEBUG_MODE

/* system log data type */
typedef struct {
  uint32_t timestamp;
  uint8_t level;
  uint8_t source;
  uint8_t key;
  uint8_t _reserved;
  uint8_t value[8];
} LOG;

/* log level type */
typedef enum {
  LOG_FATAL = 0,
  LOG_ERROR,
  LOG_WARN,
  LOG_INFO,
  LOG_DEBUG,
} LOG_LEVEL;

/* log source types */
typedef enum {
  ECU = 0,
  ESP,
  BMS,
  INV,
  ANALOG,
  GPIO,
  ACC,
  GPS,
  LCD,
} LOG_SOURCE;

typedef enum {
  ECU_BOOT = 0,
  ECU_STATE,
} LOG_KEY_ECU;

typedef enum {
  ESP_INIT = 0,
  ESP_REMOTE_CONNECT,
  ESP_RTC_SYNC,
} LOG_KEY_ESP;

typedef enum {
  BMS_CORE = 0,
  BMS_TEMP,
} LOG_KEY_BMS;

typedef enum {
  INV_TEMP_1 = 0,
  INV_TEMP_3,
  INV_ANALOG_IN,
  INV_MOTOR_POS,
  INV_CURRENT,
  INV_VOLTAGE,
  INV_FLUX,
  INV_REF,
  INV_STATE,
  INV_FAULT,
  INV_TORQUE,
  INV_FLUX_WEAKING,
} LOG_KEY_INV;

typedef enum {
  ADC_TEMP = 0,
  ADC_DIST_FL,
  ADC_DIST_RL,
  ADC_DIST_FR,
  ADC_DIST_RR,
  ADC_SPD_FL,
  ADC_SPD_RL,
  ADC_SPD_FR,
  ADC_SPD_RR,
  ADC_COUNT,
  ADC_INIT
} LOG_KEY_ANALOG;

typedef enum {
  ACC_INIT = 0,
  ACC_DATA,
} LOG_KEY_ACC;

typedef enum {
  GPS_INIT = 0,
  GPS_DATA,
} LOG_KEY_GPS;

typedef enum {
  LCD_INIT = 0,
} LOG_KEY_LCD;

/* system state type */
typedef struct {
  /* GPIOs */
  uint8_t HV :1;
  uint8_t RTD :1;
  uint8_t BMS :1;
  uint8_t IMD :1;
  uint8_t BSPD :1;

  /* connections */
  uint8_t SD :1;
  uint8_t CAN :1;
  uint8_t ACC :1;
  uint8_t LCD :1;
  uint8_t GPS :1;
} SYSTEM_STATE;

/* Prototypes */
extern LOG syslog;
inline int SYS_LOG(LOG_LEVEL level, LOG_SOURCE source, int key) {
  syslog.timestamp = HAL_GetTick();
  syslog.level = level;
  syslog.source = source;
  syslog.key = key;

  SD_WRITE();
  // HAL_I2C_Master_Transmit_IT(&hi2c1, ESP_I2C_ADDR, (uint8_t *)&syslog, 16 /* sizeof(LOG) */);

  #ifdef DEBUG_MODE
    printf("[%8lu] [LOG] level: %d  source: %d  key: %d  value: 0x %02x %02x %02x %02x %02x %02x %02x %02x\r\n", syslog.timestamp, syslog.level, syslog.source, syslog.key, syslog.value[7], syslog.value[6], syslog.value[5], syslog.value[4], syslog.value[3], syslog.value[2], syslog.value[1], syslog.value[0]);
  #endif
  return 0;
}

#endif /* INC_LOGGER_H_ */
