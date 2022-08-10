/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
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
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "adc.h"
#include "can.h"
#include "dma.h"
#include "fatfs.h"
#include "i2c.h"
#include "rtc.h"
#include "sdio.h"
#include "tim.h"
#include "usart.h"
#include "gpio.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <inttypes.h>
#include <time.h>

#include "ringbuffer.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
typedef struct {
	uint8_t* component;
	uint8_t* level;
	uint8_t* key;
	uint8_t* value;
} log_t;

typedef struct {
	uint8_t* name;
	uint32_t value;
	GPIO_TypeDef* port;
	uint16_t pin;
} GPIO_t;

typedef enum {
	LV_ACTIVE = 0,
	RTD = 1,
	BRAKE = 2,
	IMD = 3,
	BMS = 4,
	BSPD = 5,
	HVD = 6
} GPIO_INPUT_t;

typedef enum {
	GPS_TIME = 0,
	GPS_VALID,
	LAT,
	LAT_DIR,
	LON,
	LON_DIR,
	GROUND_SPEED,
	TRACK_ANGLE,
	GPS_DATE,
	COMPASS,
	COMPASS_DIR
} GPRMC_t;

typedef enum {
	CAN_BMS_CORE = 0,
	CAN_BMS_TEMP,
	CAN_INV_TEMP_1,
	CAN_INV_TEMP_3,
	CAN_INV_ANALOG_IN,
	CAN_INV_MOTOR_POS,
	CAN_INV_CURRENT,
	CAN_INV_VOLTAGE,
	CAN_INV_FLUX,
	CAN_INV_REF,
	CAN_INV_STATE,
	CAN_INV_FAULT,
	CAN_INV_TORQUE,
	CAN_INV_FLUX_WEAKING
} CAN_MSG_t;

typedef enum {
	CAN_BMS_CORE_ID = 0x6B0,
	CAN_BMS_TEMP_ID = 0x6B1,
	CAN_INV_TEMP_1_ID = 0xA0,
	CAN_INV_TEMP_3_ID = 0xA2,
	CAN_INV_ANALOG_IN_ID = 0xA3,
	CAN_INV_MOTOR_POS_ID = 0xA5,
	CAN_INV_CURRENT_ID = 0xA6,
	CAN_INV_VOLTAGE_ID = 0xA7,
	CAN_INV_FLUX_ID = 0xA8,
	CAN_INV_REF_ID = 0xA9,
	CAN_INV_STATE_ID = 0xAA,
	CAN_INV_FAULT_ID = 0xAB,
	CAN_INV_TORQUE_ID = 0xAC,
	CAN_INV_FLUX_WEAKING_ID = 0xAD
} CAN_MSG_ID_t;
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
#define DEBUG_MODE 0
#define GPS_DEBUG 0

#define INPUT_GPIO_COUNT 7

// ADC temperature sensor calibration values
#define TS_CAL1 *((uint16_t*)0x1FFF7A2C)
#define TS_CAL2 *((uint16_t*)0x1FFF7A2E)

// LCD
#define LCD_I2C_ADRESS 0x27 << 1

// CAN
#define CAN_MSG_COUNT 14

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

/* USER CODE BEGIN PV */

// error handler log
log_t errlog;

// SD file system;
FATFS SDFatFs;

// boot RTC time
uint64_t boot;
uint8_t logfile[30];
uint32_t isRTCFixed = false;

uint32_t isGPSFixed = false;

// 8KB log buffer
ring_buffer_t logbuffer;

// GPS UART6 receive buffer
uint8_t gps_rxd;
uint8_t gps_rxs[120];
uint32_t gps_valid = false;

// WiFi UART3 receive buffer
uint8_t wifi_rxd;
uint8_t wifi_rxs[50];
uint32_t wifi_valid = false;

// GPIO status
GPIO_t GPIO[8] = {
		{ .name = "HV",    .value = false, .port = GPIOD, .pin = LV_ACTIVE_Pin },
		{ .name = "RTD",   .value = false, .port = GPIOD, .pin = RTD_Pin },
		{ .name = "BRAKE", .value = false, .port = GPIOD, .pin = BRAKE_Pin },
		{ .name = "IMD",   .value = false, .port = GPIOD, .pin = IMD_Pin },
		{ .name = "BMS",   .value = false, .port = GPIOD, .pin = BMS_Pin },
		{ .name = "BSPD",  .value = false, .port = GPIOD, .pin = BSPD_Pin },
		{ .name = "HVD",   .value = false, .port = GPIOD, .pin = HVD_Pin }
};

// ADC temperature value
uint32_t adc_valid = false;
uint32_t core_temperature;

// GPIO update on socket connection
uint32_t isGPIOcheckedAfterSocketConnected = false;
uint32_t socketConnectedTime;

// LCD update flag
uint32_t lcd_valid = false;

// CAN receiver config
CAN_RxHeaderTypeDef can_rxh;
uint8_t can_rxb[8];
uint8_t can_rxd[CAN_MSG_COUNT][8];
uint32_t can_valid[CAN_MSG_COUNT] = { false, };
uint32_t can_active = false;
uint8_t *can_msg_id[CAN_MSG_COUNT] = { "CAN_BMS_CORE", "CAN_BMS_TEMP", "CAN_INV_TEMP_1", "CAN_INV_TEMP_3",
						   "CAN_INV_ANALOG_IN", "CAN_INV_MOTOR_POS", "CAN_INV_CURRENT", "CAN_INV_VOLTAGE",
						   "CAN_INV_FLUX", "CAN_INV_REF", "CAN_INV_STATE", "CAN_INV_FAULT",
						   "CAN_INV_TORQUE", "CAN_INV_FLUX_WEAKING" };

// SD mount flag
uint32_t sd_valid = false;

/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */
int _write(int file, uint8_t *ptr, int len)
{
   HAL_UART_Transmit(&huart1, (uint8_t *)ptr, (uint16_t)len, 100);
   return (len);
}

uint64_t getDateTimeBits() {
	uint64_t result = 0;

	RTC_DateTypeDef sDate;
	RTC_TimeTypeDef sTime;

	HAL_RTC_GetTime(&hrtc, &sTime, FORMAT_BIN);
	HAL_RTC_GetDate(&hrtc, &sDate, FORMAT_BIN);

	result |= (uint64_t)(sTime.SubSeconds);
	result |= (uint64_t)(sTime.Seconds) << 8;
	result |= (uint64_t)(sTime.Minutes) << 16;
	result |= (uint64_t)(sTime.Hours) << 24;
	result |= (uint64_t)(sDate.Date) << 32;
	result |= (uint64_t)(sDate.Month) << 40;
	result |= (uint64_t)(sDate.Year) << 48;

	return result;
}


void SD_Setup() {
	// INIT & MOUNT
	disk_initialize((BYTE) 0);
	uint32_t err = f_mount(&SDFatFs, "", 0);

	#if DEBUG_MODE
		printf("mount err: %d\n", err);
	#endif
	if(err != FR_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "SD";
		errlog.value = malloc(17);
		sprintf(errlog.value, "SD_MOUNT_ERR: %d", err);

		Error_Handler();
		free(errlog.value);
	}

	sd_valid = true;

	log_t log;
	log.component = "ECU";
	log.level = "INFO";
	log.key = "SD";
	log.value = "SD_MOUNTED";
	LOGGER(&log);
}


uint8_t* log_string_generator(log_t* log, uint8_t* str, uint32_t* logsize) {
	uint64_t timestamp = getDateTimeBits();

	// set log content
	sprintf(str, "![%s]\t[20%d-%02d-%02d %02d:%02d:%02d.%03d]\t%s\t\t%s\t\t\t%s\n",
			log->level,
			(uint32_t)(timestamp >> 48), (uint32_t)(timestamp << 16 >> 56), (uint32_t)(timestamp << 24 >> 56),
			(uint32_t)(timestamp << 32 >> 56), (uint32_t)(timestamp << 40 >> 56), (uint32_t)(timestamp << 48 >> 56), (int)(999.0 / 255.0 * (float)(255 - (timestamp << 56 >> 56))),
			log->component, log->key, log->value);

	*logsize = strlen(str);
	return str;
}

void LOGGER(log_t* log) {
	uint8_t* content = malloc(100);
	uint32_t logsize;

	log_string_generator(log, content, &logsize);

	// append log to buffer
	ring_buffer_queue_arr(&logbuffer, content, logsize + 1);

	#if DEBUG_MODE
		printf("LOG: %s", content);
	#endif

	// mount SD
	if (!sd_valid) {
		SD_Setup();
	}

	// SAVE TO SD
	FIL file;
	uint32_t writtenBytesCount;

	// OPEN FILE
	uint32_t err = f_open(&file, logfile, FA_OPEN_APPEND | FA_WRITE);
	#if DEBUG_MODE
		printf("sd open: %d, %s\n", err, logfile);
	#endif
	if (err != FR_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "SD";
		errlog.value = malloc(16);
		sprintf(errlog.value, "SD_OPEN_ERR: %d", err);

		Error_Handler();
		free(errlog.value);
	}

	// WRITE TO FILE
	err = f_write(&file, content, logsize, (void *)&writtenBytesCount);
	#if DEBUG_MODE
		printf("sd write: %d, %s, %d\n", err, logfile, writtenBytesCount);
	#endif
	if (err != FR_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "SD";
		errlog.value = malloc(17);
		sprintf(errlog.value, "SD_WRITE_ERR: %d", err);

		Error_Handler();
		free(errlog.value);
	}

	// CLOSE FILE
	err = f_close(&file);
	#if DEBUG_MODE
		printf("sd close: %d\n\n", err);
	#endif
	if(err != FR_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "SD";
		errlog.value = malloc(17);
		sprintf(errlog.value, "SD_CLOSE_ERR: %d", err);

		Error_Handler();
		free(errlog.value);
	}

	free(content);
}


/* ========== GPIO START ========== */
void Sensor_Setup() {
	// internal temperature sensor time
	HAL_TIM_Base_Start_IT(&htim4);

	// initialize APPS pin
	HAL_GPIO_WritePin(GPIOD, APPS_Pin, GPIO_PIN_SET);

	// initialize RTDS pin
	HAL_GPIO_WritePin(GPIOA, RTDS_Pin, GPIO_PIN_SET);

	// read initial GPIO states
	for (uint32_t i = 0; i < INPUT_GPIO_COUNT; i++) {
		GPIO[i].value = HAL_GPIO_ReadPin(GPIO[i].port, GPIO[i].pin);

		log_t log;
		log.component = "ECU";
		log.level = "INFO";
		log.key = "GPIO";
		log.value = malloc(strlen(GPIO[i].name) + 3);
		sprintf(log.value, "%s %d", GPIO[i].name, (GPIO[i].value));
		LOGGER(&log);
		free(log.value);
	}
}

void Sensor_Manager() {
	if (adc_valid) {
		log_t log;
		log.component = "ECU";
		log.level = "INFO";
		log.key = "TEMPERATURE";
		log.value = malloc(5);
		sprintf(log.value, "%d", core_temperature);
		LOGGER(&log);
		free(log.value);

		adc_valid = false;
	}

	// detect GPIO state change
	for (uint32_t i = 0; i < INPUT_GPIO_COUNT; i++) {
		if (GPIO[i].value != HAL_GPIO_ReadPin(GPIO[i].port, GPIO[i].pin)) {
			log_t log;
			log.component = "ECU";
			log.level = "INFO";
			log.key = "GPIO";
			log.value = malloc(strlen(GPIO[i].name) + 3);
			sprintf(log.value, "%s %d", GPIO[i].name, !(GPIO[i].value));
			LOGGER(&log);
			free(log.value);

			GPIO[i].value = !(GPIO[i].value);
		}
	}
}
/* ========== GPIO END ========== */


void RTD_Manager() {
	static uint32_t RTD_FLAG = false;
	static uint32_t RTD_COUNTER_ACTIVE = false;

	static uint32_t RTD_TIMER;

	// read RTD related GPIO state
	uint32_t LV_ACTIVE    = HAL_GPIO_ReadPin(GPIOD, LV_ACTIVE_Pin);
	uint32_t RTD       	 = HAL_GPIO_ReadPin(GPIOD, RTD_Pin);
	uint32_t BRAKE        = HAL_GPIO_ReadPin(GPIOD, BRAKE_Pin);

	// on RTD condition
	if (!RTD_FLAG && LV_ACTIVE && RTD && BRAKE) {
	  // START RTD ACTIVATION TIMER
	  if (!RTD_COUNTER_ACTIVE) {
		 RTD_COUNTER_ACTIVE = true;
		 RTD_TIMER = HAL_GetTick();
	  }

	  // RTD ACTIVATION SEQUENCE
	  else if (HAL_GetTick() - RTD_TIMER > 1000) {
		 // Mark RTD active
		 RTD_FLAG = true;

		 // Play RTDS
		 HAL_GPIO_WritePin(GPIOA, RTDS_Pin, GPIO_PIN_RESET);
		 HAL_TIM_Base_Start_IT(&htim2);

		 // Activate APPS relay
		 HAL_GPIO_WritePin(GPIOD, APPS_Pin, GPIO_PIN_SET);

		 // Turn on RTD indicator LED
		 HAL_GPIO_WritePin(GPIOD, RTD_ACTIVE_Pin, GPIO_PIN_SET);

		 log_t log;
		 log.component = "ECU";
		 log.level = "INFO";
		 log.key = "RTD";
		 log.value = malloc(10);
		 sprintf(log.value, "%d", HAL_GetTick());
		 LOGGER(&log);
		 free(log.value);
	  }
	}
	// RTD abort
	else {
	  RTD_COUNTER_ACTIVE = false;
	}
}


/* ========== CAN RECEIVER START ========== */
void CAN_Setup() {
   CAN_FilterTypeDef CAN_Filter_Config;

   CAN_Filter_Config.FilterBank = 0;
   CAN_Filter_Config.FilterMode = CAN_FILTERMODE_IDMASK;
   CAN_Filter_Config.FilterScale = CAN_FILTERSCALE_32BIT;
   CAN_Filter_Config.FilterIdHigh = 0x0000;
   CAN_Filter_Config.FilterIdLow = 0x0000;
   CAN_Filter_Config.FilterMaskIdHigh = 0x0000;
   CAN_Filter_Config.FilterMaskIdLow = 0x0000;
   CAN_Filter_Config.FilterFIFOAssignment = CAN_RX_FIFO0;
   CAN_Filter_Config.FilterActivation = ENABLE;
   CAN_Filter_Config.SlaveStartFilterBank = 14;

   // CAN configuration
   if (HAL_CAN_ConfigFilter(&hcan1, &CAN_Filter_Config) != HAL_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "CAN";
		errlog.value = malloc(25);
		sprintf(errlog.value, "HAL_CAN_ConfigFilter_ERR");

		Error_Handler();
		free(errlog.value);
   }

   // CAN start
   if (HAL_CAN_Start(&hcan1) != HAL_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "CAN";
		errlog.value = malloc(18);
		sprintf(errlog.value, "HAL_CAN_Start_ERR");

		Error_Handler();
		free(errlog.value);
   }

   // CAN RX notification activation
   if (HAL_CAN_ActivateNotification(&hcan1, CAN_IT_RX_FIFO0_MSG_PENDING) != HAL_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "CAN";
		errlog.value = malloc(61);
		sprintf(errlog.value, "HAL_CAN_ActivateNotification_CAN_IT_RX_FIFO0_MSG_PENDING_ERR");

		Error_Handler();
		free(errlog.value);
   }
   can_active = true;

   // CAN RX FULL notification activation
   if (HAL_CAN_ActivateNotification(&hcan1, CAN_IT_RX_FIFO0_FULL) != HAL_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "CAN";
		errlog.value = malloc(54);
		sprintf(errlog.value, "HAL_CAN_ActivateNotification_CAN_IT_RX_FIFO0_FULL_ERR");

		Error_Handler();
		free(errlog.value);
   }
}

void HAL_CAN_RxFifo0MsgPendingCallback(CAN_HandleTypeDef *CAN_Handle) {
	if (HAL_CAN_GetRxMessage(CAN_Handle, CAN_RX_FIFO0, &can_rxh, can_rxb) != HAL_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "CAN";
		errlog.value = malloc(25);
		sprintf(errlog.value, "HAL_CAN_GetRxMessage_ERR");

		Error_Handler();
		free(errlog.value);
	}

	switch (can_rxh.StdId) {
		case CAN_BMS_CORE_ID:
			memcpy(can_rxd[CAN_BMS_CORE], can_rxb, 8);
			can_valid[CAN_BMS_CORE] = true;
			break;

		case CAN_BMS_TEMP_ID:
			memcpy(can_rxd[CAN_BMS_TEMP], can_rxb, 8);
			can_valid[CAN_BMS_TEMP] = true;
			break;

		case CAN_INV_TEMP_1_ID:
			memcpy(can_rxd[CAN_INV_TEMP_1], can_rxb, 8);
			can_valid[CAN_INV_TEMP_1] = true;
			break;

		case CAN_INV_TEMP_3_ID:
			memcpy(can_rxd[CAN_INV_TEMP_3], can_rxb, 8);
			can_valid[CAN_INV_TEMP_3] = true;
			break;

		case CAN_INV_ANALOG_IN_ID:
			memcpy(can_rxd[CAN_INV_ANALOG_IN], can_rxb, 8);
			can_valid[CAN_INV_ANALOG_IN] = true;
			break;

		case CAN_INV_MOTOR_POS_ID:
			memcpy(can_rxd[CAN_INV_MOTOR_POS], can_rxb, 8);
			can_valid[CAN_INV_MOTOR_POS] = true;
			break;

		case CAN_INV_CURRENT_ID:
			memcpy(can_rxd[CAN_INV_CURRENT], can_rxb, 8);
			can_valid[CAN_INV_CURRENT] = true;
			break;

		case CAN_INV_VOLTAGE_ID:
			memcpy(can_rxd[CAN_INV_VOLTAGE], can_rxb, 8);
			can_valid[CAN_INV_VOLTAGE] = true;
			break;

		case CAN_INV_FLUX_ID:
			memcpy(can_rxd[CAN_INV_FLUX], can_rxb, 8);
			can_valid[CAN_INV_FLUX] = true;
			break;

		case CAN_INV_REF_ID:
			memcpy(can_rxd[CAN_INV_REF], can_rxb, 8);
			can_valid[CAN_INV_REF] = true;
			break;

		case CAN_INV_STATE_ID:
			memcpy(can_rxd[CAN_INV_STATE], can_rxb, 8);
			can_valid[CAN_INV_STATE] = true;
			break;

		case CAN_INV_FAULT_ID:
			memcpy(can_rxd[CAN_INV_FAULT], can_rxb, 8);
			can_valid[CAN_INV_FAULT] = true;
			break;

		case CAN_INV_TORQUE_ID:
			memcpy(can_rxd[CAN_INV_TORQUE], can_rxb, 8);
			can_valid[CAN_INV_TORQUE] = true;
			break;

		case CAN_INV_FLUX_WEAKING_ID:
			memcpy(can_rxd[CAN_INV_FLUX_WEAKING], can_rxb, 8);
			can_valid[CAN_INV_FLUX_WEAKING] = true;
			break;
	}
}

void HAL_CAN_RxFifo0FullCallback(CAN_HandleTypeDef *CAN_Handle) {
	// deactivate CAN RX on FIFO FULL
	if (HAL_CAN_DeactivateNotification(&hcan1, CAN_IT_RX_FIFO0_MSG_PENDING) != HAL_OK) {
		errlog.component = "ECU";
		errlog.level = "ERRR";
		errlog.key = "CAN";
		errlog.value = malloc(63);
		sprintf(errlog.value, "HAL_CAN_DeactivateNotification_CAN_IT_RX_FIFO0_MSG_PENDING_ERR");

		Error_Handler();
		free(errlog.value);
	}
	can_active = false;
}

void CAN_Manager() {
	for (uint32_t i = 0; i < CAN_MSG_COUNT; i++) {
		if (can_valid[i]) {
			log_t log;
	        log.component = i < 2 ? "BMS" : "INV";
	        log.level = (i == 0 && (can_rxd[i][5] | can_rxd[i][6])) ? "ERRR" : "INFO";
	        log.key = can_msg_id[i];
			log.value = malloc(40);
			sprintf(log.value, "0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X", can_rxd[i][0], can_rxd[i][1], can_rxd[i][2], can_rxd[i][3], can_rxd[i][4], can_rxd[i][5], can_rxd[i][6], can_rxd[i][7]);
			LOGGER(&log);
			free(log.value);

			can_valid[i] = false;
		}
	}

	if (!can_active) {
		// CAN RX notification activation
		if (HAL_CAN_ActivateNotification(&hcan1, CAN_IT_RX_FIFO0_MSG_PENDING) != HAL_OK) {
			errlog.component = "ECU";
			errlog.level = "ERRR";
			errlog.key = "CAN";
			errlog.value = malloc(61);
			sprintf(errlog.value, "HAL_CAN_ActivateNotification_CAN_IT_RX_FIFO0_MSG_PENDING_ERR");

			Error_Handler();
			free(errlog.value);
		}
	}
}

void HAL_CAN_ErrorCallback(CAN_HandleTypeDef *hcan) {
	errlog.component = "ECU";
	errlog.level = "ERRR";
	errlog.key = "CAN";
	errlog.value = malloc(26);
	sprintf(errlog.value, "HAL_CAN_ErrorCallback_ERR");

	Error_Handler();
	free(errlog.value);
}
/* ========== CAN RECEIVER END ========== */


void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
	// for GPS
	if(huart->Instance == USART6) {
		// process only if data is not ready
		if(gps_valid) return;
		else {
			// received character position
			static uint32_t len = 0;

			// if received data is line ending
			if(gps_rxd == '\n') {
				gps_rxs[len] = '\0';
				len = 0;

				// process only if received line is GPRMC
				if(strstr(gps_rxs, "$GPRMC")) {
					// set GPS data ready
					gps_valid = true;
					return;
				}
			}

			// append received byte to receive buffer
			else gps_rxs[len++] = gps_rxd;

			// re-enable UART interrupt
			HAL_UART_Receive_IT(&huart6, &gps_rxd, 1);
		}
	}

	// for WiFi
	else if(huart->Instance == USART3) {
		// process only if data is ready to processed
		if(wifi_valid) return;
		else {
			static uint32_t len = 0;

			if(wifi_rxd == '\n') {
				wifi_rxs[len] = '\0';
				len = 0;

				// set flag only if received line contains $ESP
				if(strstr(wifi_rxs, "$ESP")) {
					wifi_valid = true;
					return;
				}
			}

			else {
				// cut received buffer if len > 50
				if (len == 50) len = 0;
				wifi_rxs[len++] = wifi_rxd;
			}

			// re-enable UART interrupt
			HAL_UART_Receive_IT(&huart3, &wifi_rxd, 1);
		}
	}
}


/* ========== GPS RECEIVER START ========== */
void GPS_Setup() {
	const uint8_t NMEA_cmd[5][16] = {
		{ 0xB5, 0x62, 0x06, 0x01, 0x08, 0x00, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x24 }, // disable GxGGA
		{ 0xB5, 0x62, 0x06, 0x01, 0x08, 0x00, 0xF0, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x2B }, // disable GxGLL
		{ 0xB5, 0x62, 0x06, 0x01, 0x08, 0x00, 0xF0, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x32 }, // disable GxGSA
		{ 0xB5, 0x62, 0x06, 0x01, 0x08, 0x00, 0xF0, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x39 }, // disable GxGSV
		{ 0xB5, 0x62, 0x06, 0x01, 0x08, 0x00, 0xF0, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x47 }  // disable GxVTG
	};
	const uint8_t UBX_cmd[14] = { 0xB5, 0x62, 0x06, 0x08, 0x06, 0x00, 0xC8, 0x00, 0x01, 0x00, 0x01, 0x00, 0xDE, 0x6A }; // set update rate 5Hz

	HAL_UART_Transmit(&huart6, NMEA_cmd[0], 16 ,100);
	HAL_UART_Transmit(&huart6, NMEA_cmd[1], 16 ,100);
	HAL_UART_Transmit(&huart6, NMEA_cmd[2], 16 ,100);
	HAL_UART_Transmit(&huart6, NMEA_cmd[3], 16 ,100);
	HAL_UART_Transmit(&huart6, NMEA_cmd[4], 16 ,100);
	HAL_UART_Transmit(&huart6, UBX_cmd, 14 ,100);

	HAL_UART_Receive_IT(&huart6, &gps_rxd, 1);
}


void GPS_Manager() {
	// process only if received buffer data is ready
	if(gps_valid) {
#if DEBUG_MODE && GPS_DEBUG
		printf("GPS: %s\n", gps_rxs);
#endif

	    // process received GPRMC string
		uint8_t *gps[11];
		uint8_t *ptr = strchr(gps_rxs, ',');

		uint32_t count = 0;

		// store GPS data fields
		while (strchr(ptr + 1, ',')) {
			// calculate data field length
			uint32_t len = (uint8_t *)strchr(ptr + 1, ',') - ptr - 1;

			// NULL if there is no data
			if (!len) {
				gps[count] = NULL;
			}

			// allocate and store if data is present
			else {
				gps[count] = malloc(len + 1);
				strncpy(gps[count], ptr + 1, len);
				gps[count][len] = '\0';
			}

			// move to next data
			count++;
			ptr = strchr(ptr + 1, ',');
		}

		// fix RTC datetime from GPS
		/*
		if(!isRTCFixed && gps[GPS_TIME] && gps[GPS_DATE]) {
			RTC_DateTypeDef sDate;
			RTC_TimeTypeDef sTime;

			uint8_t timebuffer[3];

			strncpy(timebuffer, gps[GPS_TIME], 2);
			sTime.Hours = (uint8_t)strtol(timebuffer, NULL, 10) + 9;
			strncpy(timebuffer, gps[GPS_TIME] + 2, 2);
			sTime.Minutes = (uint8_t)strtol(timebuffer, NULL, 10);
			strncpy(timebuffer, gps[GPS_TIME] + 4, 2);
			sTime.Seconds = (uint8_t)strtol(timebuffer, NULL, 10);

			strncpy(timebuffer, gps[GPS_DATE], 2);
			sDate.Date = (uint8_t)strtol(timebuffer, NULL, 10);
			strncpy(timebuffer, gps[GPS_DATE] + 2, 2);
			sDate.Month = (uint8_t)strtol(timebuffer, NULL, 16);
			strncpy(timebuffer, gps[GPS_DATE] + 4, 2);
			sDate.Year = (uint8_t)strtol(timebuffer, NULL, 10);

			sDate.WeekDay = 0;
			HAL_RTC_SetTime(&hrtc, &sTime, FORMAT_BIN);
			HAL_RTC_SetDate(&hrtc, &sDate, FORMAT_BIN);

		    log_t log;
		    log.component = "ECU";
		    log.level = "INFO";
		    log.key = "RTC";
		    log.value = "RTC_DATETIME_FIX_GPS";
		    LOGGER(&log);

		    isRTCFixed = true;
		}
		*/

		// on valid GPS fix
		if(gps[gps_valid][0] == 'A') {
			// log if GPS got fix
			if(!isGPSFixed) {
				log_t log;
		        log.component = "ECU";
		        log.level = "INFO";
		        log.key = "GPS_STATE";
		        log.value = "1";
		        LOGGER(&log);
			    isGPSFixed = true;
			}

		    // log GPS fix info
		    log_t log;
	        log.component = "ECU";
	        log.level = "INFO";
	        log.key = "GPS_FIX";
	        log.value = gps_rxs;
	        LOGGER(&log);
		}
		// on invalid GPS fix
		else {
			// log if GPS lost fix
			if(isGPSFixed) {
				log_t log;
		        log.component = "ECU";
		        log.level = "INFO";
		        log.key = "GPS_STATE";
		        log.value = "0";
		        LOGGER(&log);
			    isGPSFixed = false;
			}
		}

		for(int i = 0; i < 11; i++) free(gps[i]);

		// mark data used
		gps_valid = false;

		// re-enable interrupt
		HAL_UART_Receive_IT(&huart6, &gps_rxd, 1);
	}
}
/* ========== GPS RECEIVER END ========== */


/* ========== WiFi START ========== */
void WiFi_Manager() {
	static uint32_t isWiFiSocketConnected = false;

	if (wifi_valid) {
#if DEBUG_MODE
				printf("WiFi: %s\n", wifi_rxs);
#endif

		// on ESP socket connection
		if (strstr(wifi_rxs, "SOCKET_CONNECTED")) {
			log_t log;
			log.component = "ECU";
			log.level = "INFO";
			log.key = "WIFI";
			log.value = wifi_rxs;
			LOGGER(&log);

			isWiFiSocketConnected = true;
		}

		// on ESP socket disconnection
		else if (strstr(wifi_rxs, "SOCKET_DISCONNECTED")) {
			if (isWiFiSocketConnected) {
				log_t log;
				log.component = "ECU";
				log.level = "INFO";
				log.key = "WIFI";
				log.value = wifi_rxs;
				LOGGER(&log);
			}

			isWiFiSocketConnected = false;
		}

		// on other ESP messages
		else {
			log_t log;
			log.component = "ECU";
			log.level = "INFO";
			log.key = "WIFI";
			log.value = wifi_rxs;
			LOGGER(&log);

			// process if message is RTC_FIX
			if(strstr(wifi_rxs, "RTC_FIX")) {
				// datetime string start index
				uint8_t *index = strstr(wifi_rxs, "RTC_FIX") + 10;
				uint8_t temp[3];

				uint32_t cnt = 0;

				if(*index) {
					RTC_DateTypeDef sDate;
					RTC_TimeTypeDef sTime;

					// process each date and time
					while (*index) {
						strncpy(temp, index, 3);
						temp[2] = '\0';

						switch (cnt) {
							case 0: sDate.Year = (uint8_t)strtol(temp, NULL, 10); break;
							case 1: sDate.Month = (uint8_t)strtol(temp, NULL, 16); break;
							case 2: sDate.Date = (uint8_t)strtol(temp, NULL, 10); break;
							case 3: sTime.Hours = (uint8_t)strtol(temp, NULL, 10); break;
							case 4: sTime.Minutes = (uint8_t)strtol(temp, NULL, 10); break;
							case 5: sTime.Seconds = (uint8_t)strtol(temp, NULL, 10); break;
						}

						// move to next date or time
						index += 3;
						cnt++;
					}

					// set weekday to valid value: must required for accurate year
					sDate.WeekDay = 0;

					// set RTC
					HAL_RTC_SetTime(&hrtc, &sTime, FORMAT_BIN);
					HAL_RTC_SetDate(&hrtc, &sDate, FORMAT_BIN);

					log_t log;
					log.component = "ECU";
					log.level = "INFO";
					log.key = "RTC";
					log.value = "RTC_DATETIME_FIX_WIFI";
					LOGGER(&log);
				}
			}

			// check if ESP is online on ECU boot
			else if (strstr(wifi_rxs, "STANDBY")) {
				isWiFiSocketConnected = true;
			}
		}

		// mark process complete and re-enable UART interrupt
		wifi_valid = false;
		HAL_UART_Receive_IT(&huart3, &wifi_rxd, 1);
	}

	if (isWiFiSocketConnected) {
		// check all GPIO in 100ms interval after socket connection
		if (!isGPIOcheckedAfterSocketConnected) {
			static uint32_t checkedGPIOcount = 0;
			if (!socketConnectedTime) socketConnectedTime = HAL_GetTick();

			if (HAL_GetTick() > socketConnectedTime + 100 * (checkedGPIOcount + 5)) {
				GPIO[checkedGPIOcount].value = HAL_GPIO_ReadPin(GPIO[checkedGPIOcount].port, GPIO[checkedGPIOcount].pin);

				log_t log;
				log.component = "ECU";
				log.level = "INFO";
				log.key = "GPIO";
				log.value = malloc(strlen(GPIO[checkedGPIOcount].name) + 3);
				sprintf(log.value, "%s %d", GPIO[checkedGPIOcount].name, (GPIO[checkedGPIOcount].value));
				LOGGER(&log);
				free(log.value);

				checkedGPIOcount++;

				if (checkedGPIOcount == INPUT_GPIO_COUNT) {
					isGPIOcheckedAfterSocketConnected = true;
				}
			}
		}

		// flush ring buffer on ESP online
		while(!ring_buffer_is_empty(&logbuffer)) {
			uint32_t size = strlen(logbuffer.buffer + logbuffer.tail_index) + 1;
			uint8_t* buf = malloc(size);

			ring_buffer_dequeue_arr(&logbuffer, buf, size);

			HAL_UART_Transmit(&huart3, buf, size, 100);
			free(buf);
		}
	}
}
/* ========== WiFi END ========== */


// TIMER configuration
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim) {
	static uint32_t TIMER2_ENABLE = false;

	// RTDS button-press simulation for DFPlayer Mini
	if (htim->Instance == TIM2) { // 200ms
	  if (TIMER2_ENABLE) {
		 HAL_GPIO_WritePin(GPIOA, RTDS_Pin, GPIO_PIN_SET);
		 HAL_TIM_Base_Stop_IT(&htim2);
	  }
	  else {
		 TIMER2_ENABLE = true;
		 return;
	  }
	}

	// internal temperature sensor
	else if (htim->Instance == TIM4) { // 5s
		HAL_ADC_Start_IT(&hadc1);
	}

	else if (htim->Instance == TIM3) { // 100ms
		lcd_valid = true;
	}
}

// TEMPERATURE SENSOR interrupt callback
void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc) {
	core_temperature = (uint32_t)(((110.0 - 30) * (HAL_ADC_GetValue(&hadc1) - TS_CAL1) / (TS_CAL2 - TS_CAL1) + 30) * 10);
	adc_valid = true;
}


/* ========== LCD START ========== */
void LCD_Send_CMD (uint8_t cmd) {
	uint8_t data_u, data_l;
	uint8_t data_t[4];
	data_u = (cmd & 0xF0);
	data_l = ((cmd << 4) & 0xF0);
	data_t[0] = data_u | 0x0C;
	data_t[1] = data_u | 0x08;
	data_t[2] = data_l | 0x0C;
	data_t[3] = data_l | 0x08;
	HAL_I2C_Master_Transmit(&hi2c2, LCD_I2C_ADRESS, (uint8_t *)data_t, 4, 10);
}

void LCD_Send_DATA (uint8_t data) {
	uint8_t data_u, data_l;
	uint8_t data_t[4];
	data_u = (data & 0xF0);
	data_l = ((data << 4) & 0xF0);
	data_t[0] = data_u | 0x0D;
	data_t[1] = data_u | 0x09;
	data_t[2] = data_l | 0x0D;
	data_t[3] = data_l | 0x09;
	HAL_I2C_Master_Transmit(&hi2c2, LCD_I2C_ADRESS, (uint8_t *)data_t, 4, 10);
}

void LCD_Write(uint8_t *str, uint8_t col, uint8_t row) {
    switch (row) {
        case 0:
            col |= 0x80;
            break;
        case 1:
            col |= 0xC0;
            break;
    }
    LCD_Send_CMD(col);

	while (*str) LCD_Send_DATA(*str++);
}

void LCD_Setup() {
	// LCD initialization sequence
	HAL_Delay(10);
	LCD_Send_CMD(0x30);
	HAL_Delay(5);
	LCD_Send_CMD(0x30);
	HAL_Delay(1);
	LCD_Send_CMD(0x30);
	LCD_Send_CMD(0x20);

	HAL_Delay(1);
	LCD_Send_CMD(0x28); // FUNCTION SET: DL=0, N=1, F=0
	LCD_Send_CMD(0x08); // DISPLAY SWITCH: D=0, C=0, B=0
	LCD_Send_CMD(0x01); // SCREEN CLEAR
	HAL_Delay(2);
	LCD_Send_CMD(0x0C); // DISPLAY SWITCH: D=1, C=0, B=0

	// display initial screen
    LCD_Write("V:", 12, 0);
    LCD_Write("T:", 12, 1);

    // LCD update rate: 100ms
	HAL_TIM_Base_Start_IT(&htim3);
}

void LCD_Manager() {
	if (lcd_valid) {
		// update LCD integer value
		uint8_t core_temp_display[3];
		uint32_t core_temp_display_value = (core_temperature + 5) / 10; // +5 for rounding
		sprintf(core_temp_display, "%d", core_temp_display_value);
	    LCD_Write(core_temp_display, 14, 1);

	    // update LCD block indicator
		static int32_t display_prev_block_count = 0;
		int32_t display_block_count = core_temp_display_value - 35;
		int32_t display_block_variance = display_block_count - display_prev_block_count;
		uint8_t fill;

		if (display_block_variance > 0) {
			fill = 0xFF;
		}
		else {
			fill = ' ';
			display_block_variance = -display_block_variance;
		}

		uint8_t* display_blocks = malloc(display_block_variance + 1);
		memset(display_blocks, fill, display_block_variance);
		display_blocks[display_block_variance] = '\0';

	    LCD_Write(display_blocks, fill == 0xFF ? display_prev_block_count : display_block_count, 1);
	    display_prev_block_count = display_block_count;

	    free(display_blocks);

		lcd_valid = false;
	}
}
/* ========== LCD END ========== */

/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{
  /* USER CODE BEGIN 1 */

  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_DMA_Init();
  MX_CAN1_Init();
  MX_TIM2_Init();
  MX_USART1_UART_Init();
  MX_I2C2_Init();
  MX_SDIO_SD_Init();
  MX_RTC_Init();
  MX_FATFS_Init();
  MX_USART6_UART_Init();
  MX_USART3_UART_Init();
  MX_ADC1_Init();
  MX_TIM4_Init();
  MX_I2C1_Init();
  MX_TIM3_Init();
  /* USER CODE BEGIN 2 */

  // set boot time and log file name
  boot = getDateTimeBits();
  sprintf(logfile, "A-FA 20%d-%02d-%02d %02d-%02d-%02d.log",
		(uint32_t)(boot >> 48), (uint32_t)(boot << 16 >> 56), (uint32_t)(boot << 24 >> 56),
		(uint32_t)(boot << 32 >> 56), (uint32_t)(boot << 40 >> 56), (uint32_t)(boot << 48 >> 56));

  // initialize 32KB log buffer
  ring_buffer_init(&logbuffer);

  // set onboard LED active
  HAL_GPIO_WritePin(GPIOA, LED1_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOA, LED2_Pin, GPIO_PIN_SET);

  // log system startup
  log_t log;
  log.component = "ECU";
  log.level = "INFO";
  log.key = "STARTUP";
  log.value = "STARTUP";
  LOGGER(&log);

  // set LCD
  LCD_Setup();

  // set WiFi
  HAL_UART_Receive_IT(&huart3, &wifi_rxd, 1);
  HAL_UART_Transmit(&huart3, "ESP CHECK", 10, 100);

  // initialize GPIOs
  Sensor_Setup();

  // set CAN
  CAN_Setup();

  // set GPS
  GPS_Setup();

  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1) {
	RTD_Manager();
	Sensor_Manager();
	CAN_Manager();
	GPS_Manager();
	WiFi_Manager();
	LCD_Manager();
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Configure the main internal regulator output voltage
  */
  __HAL_RCC_PWR_CLK_ENABLE();
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE|RCC_OSCILLATORTYPE_LSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.LSEState = RCC_LSE_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLM = 4;
  RCC_OscInitStruct.PLL.PLLN = 168;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV2;
  RCC_OscInitStruct.PLL.PLLQ = 7;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV4;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV2;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_5) != HAL_OK)
  {
    Error_Handler();
  }

  /** Enables the Clock Security System
  */
  HAL_RCC_EnableCSS();
}

/* USER CODE BEGIN 4 */

/* USER CODE END 4 */

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
	/* USER CODE BEGIN Error_Handler_Debug */
	/* User can add his own implementation to report the HAL error return state */
	//__disable_irq();
	HAL_GPIO_WritePin(GPIOA, LED1_Pin, GPIO_PIN_SET);
	HAL_GPIO_WritePin(GPIOA, LED2_Pin, GPIO_PIN_RESET);

	uint8_t* errstr = malloc(100);
	uint32_t errsize;
	log_string_generator(&errlog, errstr, &errsize);
	ring_buffer_queue_arr(&logbuffer, errstr, errsize + 1);
	free(errstr);

	printf("ERROR: %s\n", errlog.value);

	while (1) {
	  break;
	}
	/* USER CODE END Error_Handler_Debug */
}

#ifdef  USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
