/*
 * logger.h
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */

#ifndef INC_LOGGER_H_
#define INC_LOGGER_H_

#include "stdio.h"

// #define DEBUG_MODE
// #define DEBUG_LOG

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
  CAN,
  ANALOG,
  TIMER,
  ACC,
  LCD,
  GPS
} LOG_SOURCE;

typedef enum {
  ECU_BOOT = 0,
  ECU_STATE,
  ECU_READY,
  SD_INIT
} LOG_KEY_ECU;

typedef enum {
  ESP_INIT = 0,
  ESP_REMOTE,
  ESP_RTC_FIX
} LOG_KEY_ESP;

typedef enum {
  CAN_INIT = 0,
  CAN_ERR,

  CAN_INV_TEMP_1 = 0xA0,
  CAN_INV_TEMP_2 = 0xA1,
  CAN_INV_TEMP_3 = 0xA2,
  CAN_INV_ANALOG_IN = 0xA3,
  CAN_INV_DIGITAL_IN = 0xA4,
  CAN_INV_MOTOR_POS = 0xA5,
  CAN_INV_CURRENT = 0xA6,
  CAN_INV_VOLTAGE = 0xA7,
  CAN_INV_FLUX = 0xA8,
  CAN_INV_REF = 0xA9,
  CAN_INV_STATE = 0xAA,
  CAN_INV_FAULT = 0xAB,
  CAN_INV_TORQUE = 0xAC,
  CAN_INV_FLUX_WEAKING = 0xAD,

  CAN_INV_FIRMWARE_VER = 0xAE,
  CAN_INV_DIAGNOSTIC = 0xAF,

  CAN_INV_HIGH_SPD_MSG = 0xB0,

  CAN_BMS_CORE = 0x80,
  CAN_BMS_TEMP = 0x81
} LOG_KEY_CAN;

typedef enum {
  ADC_INIT = 0,
  ADC_CPU,
  ADC_DIST
} LOG_KEY_ANALOG;

typedef enum {
  TIMER_IC = 0,
} LOG_KEY_TIMER;

typedef enum {
  ACC_INIT = 0,
  ACC_DATA
} LOG_KEY_ACC;

typedef enum {
  LCD_INIT = 0,
  LCD_UPDATED
} LOG_KEY_LCD;

typedef enum {
  GPS_INIT = 0,
  GPS_POS,
  GPS_VEC,
  GPS_TIME
} LOG_KEY_GPS;

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
  uint8_t ESP :1;
  uint8_t ACC :1;
  uint8_t LCD :1;
  uint8_t GPS :1;

  uint32_t _reserved :21;
} SYSTEM_STATE;

/* Prototypes */
int32_t SYS_LOG(LOG_LEVEL level, LOG_SOURCE source, int32_t key);

#endif /* INC_LOGGER_H_ */
