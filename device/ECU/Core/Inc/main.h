/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2022 STMicroelectronics.
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

/* USER CODE END EFP */

/* Private defines -----------------------------------------------------------*/
#define LED1_Pin GPIO_PIN_6
#define LED1_GPIO_Port GPIOA
#define LED2_Pin GPIO_PIN_7
#define LED2_GPIO_Port GPIOA
#define HVD_Pin GPIO_PIN_11
#define HVD_GPIO_Port GPIOD
#define BSPD_Pin GPIO_PIN_12
#define BSPD_GPIO_Port GPIOD
#define BMS_Pin GPIO_PIN_13
#define BMS_GPIO_Port GPIOD
#define IMD_Pin GPIO_PIN_14
#define IMD_GPIO_Port GPIOD
#define RTDS_Pin GPIO_PIN_15
#define RTDS_GPIO_Port GPIOA
#define RTD_ACTIVE_Pin GPIO_PIN_3
#define RTD_ACTIVE_GPIO_Port GPIOD
#define APPS_Pin GPIO_PIN_4
#define APPS_GPIO_Port GPIOD
#define BRAKE_Pin GPIO_PIN_5
#define BRAKE_GPIO_Port GPIOD
#define RTD_Pin GPIO_PIN_6
#define RTD_GPIO_Port GPIOD
#define LV_ACTIVE_Pin GPIO_PIN_7
#define LV_ACTIVE_GPIO_Port GPIOD
/* USER CODE BEGIN Private defines */

/* USER CODE END Private defines */

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
