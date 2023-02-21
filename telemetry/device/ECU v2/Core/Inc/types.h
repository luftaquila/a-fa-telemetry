/*
 * types.h
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */

#ifndef INC_TYPES_H_
#define INC_TYPES_H_

#include "logger.h"

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
typedef enum {
  ADC_CPU = 0,
  ADC_DIST,
  ADC_SPD
} ADC_ID;

/* I2C buffer index */
typedef enum {
  I2C_BUFFER_ESP = 0;
  I2C_BUFFER_LCD
} I2C_BUFFER_ID;

/* LCD update info */
typedef struct display_data_t {
  uint16_t vehicle_speed;
  uint16_t coolant_temp;
} DISPLAY_DATA;

#endif /* INC_TYPES_H_ */
