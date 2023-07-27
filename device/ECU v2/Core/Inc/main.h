/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
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
#ifndef __MAIN_H
#define __MAIN_H

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include "stm32f4xx_hal.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "stdbool.h"
#include "types.h"
/* USER CODE END Includes */

/* Exported types ------------------------------------------------------------*/
/* USER CODE BEGIN ET */

/* USER CODE END ET */

/* Exported constants --------------------------------------------------------*/
/* USER CODE BEGIN EC */

/* USER CODE END EC */

/* Exported macro ------------------------------------------------------------*/
/* USER CODE BEGIN EM */

/* USER CODE END EM */

/* Exported functions prototypes ---------------------------------------------*/
void Error_Handler(void);

/* USER CODE BEGIN EFP */


/* macro to parse NMEA sentence */
#define FIND_AND_NUL(s, p, c) ( \
   (p) = (uint8_t *)strchr((char *)s, c), \
   *(p) = '\0', \
   ++(p), \
   (p))

inline uint32_t to_uint(uint8_t *str, char garbage) {
  uint8_t *src, *dst;
  for (src = dst = str; *src != '\0'; src++) {
    *dst = *src;
    if (*dst != garbage) dst++;
  }
  *dst = '\0';

  return atoi((char *)str);
}

inline uint32_t drop_point(uint8_t *str) {
  *(strchr((char *)str, '.')) = '\0';
  return atoi((char *)str);
}
/* USER CODE END EFP */

/* Private defines -----------------------------------------------------------*/
#define LED00_Pin GPIO_PIN_6
#define LED00_GPIO_Port GPIOA
#define LED01_Pin GPIO_PIN_7
#define LED01_GPIO_Port GPIOA
#define LED0_Pin GPIO_PIN_10
#define LED0_GPIO_Port GPIOE
#define LED1_Pin GPIO_PIN_11
#define LED1_GPIO_Port GPIOE
#define LED_HEARTBEAT_Pin GPIO_PIN_12
#define LED_HEARTBEAT_GPIO_Port GPIOE
#define LED_SD_Pin GPIO_PIN_13
#define LED_SD_GPIO_Port GPIOE
#define LED_CAN_Pin GPIO_PIN_14
#define LED_CAN_GPIO_Port GPIOE
#define LED_ESP_Pin GPIO_PIN_15
#define LED_ESP_GPIO_Port GPIOE
#define SDIO_DETECT_Pin GPIO_PIN_12
#define SDIO_DETECT_GPIO_Port GPIOB
#define RTD_ACTIVE_Pin GPIO_PIN_10
#define RTD_ACTIVE_GPIO_Port GPIOD
#define HV_ACTIVE_Pin GPIO_PIN_11
#define HV_ACTIVE_GPIO_Port GPIOD
#define BMS_FAULT_Pin GPIO_PIN_12
#define BMS_FAULT_GPIO_Port GPIOD
#define IMD_FAULT_Pin GPIO_PIN_13
#define IMD_FAULT_GPIO_Port GPIOD
#define BSPD_FAULT_Pin GPIO_PIN_14
#define BSPD_FAULT_GPIO_Port GPIOD

/* USER CODE BEGIN Private defines */
/* USER CODE END Private defines */

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
