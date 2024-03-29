/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file    i2c.h
  * @brief   This file contains all the function prototypes for
  *          the i2c.c file
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2023 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */
/* Define to prevent recursive inclusion -------------------------------------*/
#ifndef __I2C_H__
#define __I2C_H__

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include "main.h"

/* USER CODE BEGIN Includes */
#include "usart.h"
#include "rtc.h"
#include "types.h"
#include "ringbuffer.h"
#include "stdbool.h"
/* USER CODE END Includes */

extern I2C_HandleTypeDef hi2c1;

extern I2C_HandleTypeDef hi2c2;

extern I2C_HandleTypeDef hi2c3;

/* USER CODE BEGIN Private defines */
#define ESP_I2C_ADDR (0x71 << 1)
#define LCD_I2C_ADDR (0x27 << 1)
#define ACC_I2C_ADDR (0x53 << 1)

#define LCD_MODE_CMD 0
#define LCD_MODE_DATA (1 << 0)
#define LCD_PIN_EN (1 << 2)
#define LCD_BACKLIGHT (1 << 3)
/* USER CODE END Private defines */

void MX_I2C1_Init(void);
void MX_I2C2_Init(void);
void MX_I2C3_Init(void);

/* USER CODE BEGIN Prototypes */
int32_t ESP_SETUP(void);

int32_t LCD_SETUP(void);
int32_t LCD_UPDATE(void);
void LCD_WRITE(char *str, uint8_t col, uint8_t row);
void LCD_SEND(uint8_t data, uint8_t flag);
void LCD_SEND_IT(uint8_t data, uint8_t flag);
void LCD_PACKET(uint8_t data, uint8_t flag, uint8_t *payload);

int32_t ACC_SETUP(void);
void ACC_SEND(uint8_t reg, uint8_t value);
/* USER CODE END Prototypes */

#ifdef __cplusplus
}
#endif

#endif /* __I2C_H__ */

