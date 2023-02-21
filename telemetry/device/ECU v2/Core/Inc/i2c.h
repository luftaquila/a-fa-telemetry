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
#include "stdbool.h"
/* USER CODE END Includes */

extern I2C_HandleTypeDef hi2c1;

extern I2C_HandleTypeDef hi2c2;

extern I2C_HandleTypeDef hi2c3;

/* USER CODE BEGIN Private defines */
#define ESP_I2C_ADDR 0x71 << 1
#define LCD_I2C_ADDR 0x27 << 1
#define ACC_I2C_ADDR 0x53 << 1

#define LCD_PIN_RS 1 << 0
#define LCD_PIN_EN 1 << 2
#define LCD_BACKLIGHT 1 << 3
/* USER CODE END Private defines */

void MX_I2C1_Init(void);
void MX_I2C2_Init(void);
void MX_I2C3_Init(void);

/* USER CODE BEGIN Prototypes */
int32_t ESP_SETUP(void);
int32_t LCD_SETUP(void);
int32_t LCD_UPDATE(DISPLAY_DATA display_data);

void LCD_SEND(uint8_t data, uint8_t flag) {
  const uint8_t hi = data & 0xF0;
  const uint8_t lo = (data << 4) & 0xF0;

  uint8_t payload[4];
  payload[0] = hi | flag | LCD_BACKLIGHT | LCD_PIN_EN;
  payload[1] = hi | flag | LCD_BACKLIGHT;
  payload[2] = lo | flag | LCD_BACKLIGHT | LCD_PIN_EN;
  payload[3] = lo | flag | LCD_BACKLIGHT;

  HAL_I2C_Master_Transmit(&hi2c2, LCD_I2C_ADDR, (uint8_t *)payload, 4, 50);
}

inline void LCD_CMD(uint8_t cmd) {
  LCD_SEND(cmd, 0);
}

inline void LCD_DATA(uint8_t data) {
  LCD_SEND(data, LCD_PIN_RS);
}
/* USER CODE END Prototypes */

#ifdef __cplusplus
}
#endif

#endif /* __I2C_H__ */

