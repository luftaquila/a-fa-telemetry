/*
 * types.h
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */

#ifndef INC_TYPES_H_
#define INC_TYPES_H_

#include "logger.h"
#include "string.h"
#include "stdlib.h"

/* RTC datetime */
typedef struct {
  uint8_t year;
  uint8_t month;
  uint8_t date;
  uint8_t hour;
  uint8_t minute;
  uint8_t second;
} DATETIME;

/* system error code type */
typedef enum {
  ERR_ECU = 0,
  ERR_SD,
  ERR_ESP
} ERROR_CODE;

/* timer index */
typedef enum {
  TIMER_1s = 0,
  TIMER_300ms,
  TIMER_100ms,
} TIMER_ID;

/* ADC index */
typedef LOG_KEY_ANALOG ADC_ID;

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
} ADC_COMPONENT;

/* I2C buffer index */
typedef enum {
  I2C_BUFFER_ESP_REMAIN = 0,
  I2C_BUFFER_ESP_TRANSMIT,
  I2C_BUFFER_LCD_REMAIN,
  I2C_BUFFER_LCD_TRANSMIT,
} I2C_BUFFER_ID;

/* LCD update info */
typedef struct display_data_t {
  uint16_t vehicle_speed;
  uint16_t coolant_temp;
} DISPLAY_DATA;

/* NMEA GPRMC message */
typedef struct nmea_gprmc_t {
  uint8_t *id;
  uint8_t *utc_time;
  uint8_t *status;
  uint8_t *lat;
  uint8_t *north;
  uint8_t *lon;
  uint8_t *east;
  uint8_t *speed;
  uint8_t *course;
  uint8_t *utc_date;
  uint8_t *others;
} NMEA_GPRMC;

typedef struct {
  uint32_t lat;
  uint32_t lon;
} GPS_COORD;

typedef struct {
  uint16_t speed;
  uint8_t course;
  uint32_t utc_date :20;
  uint32_t utc_time :20;
} GPS_INFO;

#endif /* INC_TYPES_H_ */
