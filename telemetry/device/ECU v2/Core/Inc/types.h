/*
 * types.h
 *
 *  Created on: Feb 13, 2023
 *      Author: LUFT-AQUILA
 */

#ifndef INC_TYPES_H_
#define INC_TYPES_H_


/* system state type */
#pragma pack(push, 4)
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
  uint8_t GPS :1;
  uint8_t ACC :1;
} SYSTEM_STATE;
#pragma pack(pop)

/* system error code type */
typedef enum {
  ERR_ECU = 0,
  ERR_SD,
  ERR_ESP
} ERROR_CODE;

/* timer index */
typedef enum {
  TIMER_SD = 0,
} TIMER_ID;

#endif /* INC_TYPES_H_ */
