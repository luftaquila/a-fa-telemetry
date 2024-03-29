/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file    i2c.c
  * @brief   This file provides code for the configuration
  *          of the I2C instances.
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
/* Includes ------------------------------------------------------------------*/
#include "i2c.h"

/* USER CODE BEGIN 0 */
extern LOG syslog;
extern SYSTEM_STATE sys_state;

// I2C Tx buffers
extern uint32_t i2c_flag;

extern ring_buffer_t ESP_BUFFER;
uint8_t ESP_BUFFER_ARR[1 << 15]; // 32KB

extern ring_buffer_t LCD_BUFFER;
uint8_t LCD_BUFFER_ARR[1 << 12]; // 4KB

// accelerometer data
extern uint8_t acc_value[6];

void HAL_I2C_MasterTxCpltCallback(I2C_HandleTypeDef *hi2c) {
  // ESP
  if (hi2c->Instance == I2C1) {
    if (ring_buffer_is_empty(&ESP_BUFFER)) {
      // finish transmitting
      i2c_flag &= ~(1 << I2C_BUFFER_ESP_REMAIN);
      i2c_flag &= ~(1 << I2C_BUFFER_ESP_TRANSMIT);
    }
    else {
      static uint8_t payload[sizeof(LOG)];
      ring_buffer_dequeue_arr(&ESP_BUFFER, (char *)payload, sizeof(LOG));
      HAL_I2C_Master_Transmit_IT(&hi2c1, ESP_I2C_ADDR, payload, sizeof(LOG));
    }
  }

  // LCD
  else if (hi2c->Instance == I2C2) {
    if (ring_buffer_is_empty(&LCD_BUFFER)) {
      // finish transmitting
      i2c_flag &= ~(1 << I2C_BUFFER_LCD_REMAIN);
      i2c_flag &= ~(1 << I2C_BUFFER_LCD_TRANSMIT);
    }
    else {
      static uint8_t payload[4];
      ring_buffer_dequeue_arr(&LCD_BUFFER, (char *)payload, 4);
      HAL_I2C_Master_Transmit_IT(&hi2c2, LCD_I2C_ADDR, payload, 4);
    }
  }
  return;
}


void HAL_I2C_MemRxCpltCallback(I2C_HandleTypeDef *hi2c) {
  *(uint64_t *)syslog.value = *(uint64_t *)acc_value;
  SYS_LOG(LOG_INFO, ACC, ACC_DATA);

  sys_state.ACC = true;
  return;
}


/****************************
 * ESP32 I2C interface
 ***************************/
int32_t ESP_SETUP(void) {
  // init buffer
  ring_buffer_init(&ESP_BUFFER, (char *)ESP_BUFFER_ARR, sizeof(ESP_BUFFER_ARR));

  // ESP handshake
  HAL_Delay(1000);
  HAL_I2C_Master_Transmit(&hi2c1, ESP_I2C_ADDR, (uint8_t *)"READY", 5, 500);

  // receive ACK from UART (10 bytes)
  uint8_t ack[10];
  for (int32_t i = 0; i < 10; i++) {
    HAL_UART_Receive(&huart1, (ack + i), 1, 10);
  }

  if (strstr((char *)ack, "ACK") == NULL) {
    goto esp_fail;
  }

  // waiting for time sync (10 sec)
  uint8_t esp_rtc_fix[25];
  if (HAL_UART_Receive(&huart1, esp_rtc_fix, 25, 10000) != HAL_OK) {
    goto esp_fail;
  }

  // example: $ESP 2023-06-05-22-59-38
  if (strncmp((char *)esp_rtc_fix, "$ESP ", 5) == 0) {
    #ifdef DEBUG_MODE
      printf("[%8lu] [INF] ESP TIME SYNC: %.*s\r\n", HAL_GetTick(), 24, esp_rtc_fix);
    #endif

    sys_state.ESP = true;
    HAL_GPIO_WritePin(GPIOE, LED_ESP_Pin, GPIO_PIN_SET);

    syslog.value[0] = true;
    SYS_LOG(LOG_INFO, ESP, ESP_REMOTE);

    // set RTC
    uint8_t *ptr = esp_rtc_fix + 7;
    uint8_t tmp[3];
    int32_t cnt = 0;

    RTC_DateTypeDef RTC_DATE;
    RTC_TimeTypeDef RTC_TIME;

    while (*ptr && cnt < 6) {
      strncpy((char *)tmp, (char *)ptr, 3);
      tmp[2] = '\0';

      switch (cnt) {
        case 0: RTC_DATE.Year    = (uint8_t)strtol((char *)tmp, NULL, 10); break;
        case 1: RTC_DATE.Month   = (uint8_t)strtol((char *)tmp, NULL, 16); break;
        case 2: RTC_DATE.Date    = (uint8_t)strtol((char *)tmp, NULL, 10); break;
        case 3: RTC_TIME.Hours   = (uint8_t)strtol((char *)tmp, NULL, 10); break;
        case 4: RTC_TIME.Minutes = (uint8_t)strtol((char *)tmp, NULL, 10); break;
        case 5: RTC_TIME.Seconds = (uint8_t)strtol((char *)tmp, NULL, 10); break;
      }

      // move to next datetime
      ptr += 3;
      cnt++;
    }

    // set weekday; required for accurate year value
    RTC_DATE.WeekDay = 0;

    HAL_RTC_SetTime(&hrtc, &RTC_TIME, FORMAT_BIN);
    HAL_RTC_SetDate(&hrtc, &RTC_DATE, FORMAT_BIN);

    syslog.value[0] = RTC_DATE.Year;
    syslog.value[1] = RTC_DATE.Month;
    syslog.value[2] = RTC_DATE.Date;
    syslog.value[3] = RTC_TIME.Hours;
    syslog.value[4] = RTC_TIME.Minutes;
    syslog.value[5] = RTC_TIME.Seconds;
    SYS_LOG(LOG_INFO, ESP, ESP_RTC_FIX);

    return 0;
  }

esp_fail:
  sys_state.ESP = false;
  HAL_GPIO_WritePin(GPIOE, LED_ESP_Pin, GPIO_PIN_RESET);

  syslog.value[0] = false;
  SYS_LOG(LOG_WARN, ESP, ESP_REMOTE);
  return -1;
}


/****************************
 * 1602 LCD I2C interface
 ***************************/
int32_t LCD_SETUP(void) {
  // init buffer
  ring_buffer_init(&LCD_BUFFER, (char *)LCD_BUFFER_ARR, sizeof(LCD_BUFFER_ARR));

  // wait for LCD ready
  HAL_Delay(50);
  if (HAL_I2C_IsDeviceReady(&hi2c2, LCD_I2C_ADDR, 1, 3000) != HAL_OK) {
    sys_state.LCD = false;
    return -1;
  }

  // LCD init sequence
  LCD_SEND(0x30, LCD_MODE_CMD); // set-4 bit mod
  HAL_Delay(5);
  LCD_SEND(0x30, LCD_MODE_CMD); // retry 4-bit mod
  HAL_Delay(5);
  LCD_SEND(0x30, LCD_MODE_CMD); // final try
  HAL_Delay(1);
  LCD_SEND(0x20, LCD_MODE_CMD); // set 4-bit interface
  HAL_Delay(1);
	LCD_SEND(0x28, LCD_MODE_CMD); // FUNCTION SET: DL=0, N=1, F=0
  HAL_Delay(1);
	LCD_SEND(0x08, LCD_MODE_CMD); // DISPLAY SWITCH: D=0, C=0, B=0
  HAL_Delay(1);
	LCD_SEND(0x01, LCD_MODE_CMD); // SCREEN CLEAR
  HAL_Delay(1);
	LCD_SEND(0x0C, LCD_MODE_CMD); // DISPLAY SWITCH: D=1, C=0, B=0
  HAL_Delay(1);

  LCD_WRITE("V:", 0, 0);
  LCD_WRITE("T:", 0, 1);

  sys_state.LCD = true;
  return 0;
}

int32_t LCD_UPDATE(void) {
  // !!!!!!!!!!!!!!!!!

  return 0;
}

inline void LCD_WRITE(char *str, uint8_t col, uint8_t row) {
  col |= (row == 0 ? 0x80 : 0xC0);

  LCD_SEND_IT(col, LCD_MODE_CMD);
  while (*str) LCD_SEND_IT(*str++, LCD_MODE_DATA);
}

inline void LCD_SEND(uint8_t data, uint8_t flag) {
  uint8_t payload[4];
  LCD_PACKET(data, flag, payload);

  HAL_I2C_Master_Transmit(&hi2c2, LCD_I2C_ADDR, (uint8_t *)payload, 4, 50);
}

inline void LCD_SEND_IT(uint8_t data, uint8_t flag) {
  static uint8_t payload[4];
  LCD_PACKET(data, flag, payload);

  ring_buffer_queue_arr(&LCD_BUFFER,(char *)payload, 4);
  i2c_flag |= 1 << I2C_BUFFER_LCD_REMAIN;
}

inline void LCD_PACKET(uint8_t data, uint8_t flag, uint8_t *payload) {
  const uint8_t hi = data & 0xF0;
  const uint8_t lo = (data << 4) & 0xF0;

  *(payload)     = hi | flag | LCD_BACKLIGHT | LCD_PIN_EN;
  *(payload + 1) = hi | flag | LCD_BACKLIGHT;
  *(payload + 2) = lo | flag | LCD_BACKLIGHT | LCD_PIN_EN;
  *(payload + 3) = lo | flag | LCD_BACKLIGHT;
}


/****************************************
 * ADXL345 accelerometer I2C interface
 ***************************************/
int32_t ACC_SETUP(void) {
  // accelerometer init sequence
  ACC_SEND(0x31, 0x01);  // DATA_FORMAT range +-4g
  ACC_SEND(0x2D, 0x00);  // POWER_CTL bit reset
  ACC_SEND(0x2D, 0x08);  // POWER_CTL set measure mode. 100hz default rate

  return 0;
}

inline void ACC_SEND(uint8_t reg, uint8_t value) {
  uint8_t payload[2] = { reg, value };
  HAL_I2C_Master_Transmit(&hi2c3, ACC_I2C_ADDR, payload, 2, 50);
}
/* USER CODE END 0 */

I2C_HandleTypeDef hi2c1;
I2C_HandleTypeDef hi2c2;
I2C_HandleTypeDef hi2c3;

/* I2C1 init function */
void MX_I2C1_Init(void)
{

  /* USER CODE BEGIN I2C1_Init 0 */

  /* USER CODE END I2C1_Init 0 */

  /* USER CODE BEGIN I2C1_Init 1 */

  /* USER CODE END I2C1_Init 1 */
  hi2c1.Instance = I2C1;
  hi2c1.Init.ClockSpeed = 400000;
  hi2c1.Init.DutyCycle = I2C_DUTYCYCLE_2;
  hi2c1.Init.OwnAddress1 = 0;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c1.Init.OwnAddress2 = 0;
  hi2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  if (HAL_I2C_Init(&hi2c1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN I2C1_Init 2 */

  /* USER CODE END I2C1_Init 2 */

}
/* I2C2 init function */
void MX_I2C2_Init(void)
{

  /* USER CODE BEGIN I2C2_Init 0 */

  /* USER CODE END I2C2_Init 0 */

  /* USER CODE BEGIN I2C2_Init 1 */

  /* USER CODE END I2C2_Init 1 */
  hi2c2.Instance = I2C2;
  hi2c2.Init.ClockSpeed = 10000;
  hi2c2.Init.DutyCycle = I2C_DUTYCYCLE_2;
  hi2c2.Init.OwnAddress1 = 0;
  hi2c2.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c2.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c2.Init.OwnAddress2 = 0;
  hi2c2.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c2.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  if (HAL_I2C_Init(&hi2c2) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN I2C2_Init 2 */

  /* USER CODE END I2C2_Init 2 */

}
/* I2C3 init function */
void MX_I2C3_Init(void)
{

  /* USER CODE BEGIN I2C3_Init 0 */

  /* USER CODE END I2C3_Init 0 */

  /* USER CODE BEGIN I2C3_Init 1 */

  /* USER CODE END I2C3_Init 1 */
  hi2c3.Instance = I2C3;
  hi2c3.Init.ClockSpeed = 400000;
  hi2c3.Init.DutyCycle = I2C_DUTYCYCLE_2;
  hi2c3.Init.OwnAddress1 = 0;
  hi2c3.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c3.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c3.Init.OwnAddress2 = 0;
  hi2c3.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c3.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  if (HAL_I2C_Init(&hi2c3) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN I2C3_Init 2 */

  /* USER CODE END I2C3_Init 2 */

}

void HAL_I2C_MspInit(I2C_HandleTypeDef* i2cHandle)
{

  GPIO_InitTypeDef GPIO_InitStruct = {0};
  if(i2cHandle->Instance==I2C1)
  {
  /* USER CODE BEGIN I2C1_MspInit 0 */

  /* USER CODE END I2C1_MspInit 0 */

    __HAL_RCC_GPIOB_CLK_ENABLE();
    /**I2C1 GPIO Configuration
    PB6     ------> I2C1_SCL
    PB7     ------> I2C1_SDA
    */
    GPIO_InitStruct.Pin = GPIO_PIN_6|GPIO_PIN_7;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_OD;
    GPIO_InitStruct.Pull = GPIO_PULLUP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    GPIO_InitStruct.Alternate = GPIO_AF4_I2C1;
    HAL_GPIO_Init(GPIOB, &GPIO_InitStruct);

    /* I2C1 clock enable */
    __HAL_RCC_I2C1_CLK_ENABLE();

    /* I2C1 interrupt Init */
    HAL_NVIC_SetPriority(I2C1_EV_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(I2C1_EV_IRQn);
  /* USER CODE BEGIN I2C1_MspInit 1 */

  /* USER CODE END I2C1_MspInit 1 */
  }
  else if(i2cHandle->Instance==I2C2)
  {
  /* USER CODE BEGIN I2C2_MspInit 0 */

  /* USER CODE END I2C2_MspInit 0 */

    __HAL_RCC_GPIOB_CLK_ENABLE();
    /**I2C2 GPIO Configuration
    PB10     ------> I2C2_SCL
    PB11     ------> I2C2_SDA
    */
    GPIO_InitStruct.Pin = GPIO_PIN_10|GPIO_PIN_11;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_OD;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    GPIO_InitStruct.Alternate = GPIO_AF4_I2C2;
    HAL_GPIO_Init(GPIOB, &GPIO_InitStruct);

    /* I2C2 clock enable */
    __HAL_RCC_I2C2_CLK_ENABLE();

    /* I2C2 interrupt Init */
    HAL_NVIC_SetPriority(I2C2_EV_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(I2C2_EV_IRQn);
  /* USER CODE BEGIN I2C2_MspInit 1 */

  /* USER CODE END I2C2_MspInit 1 */
  }
  else if(i2cHandle->Instance==I2C3)
  {
  /* USER CODE BEGIN I2C3_MspInit 0 */

  /* USER CODE END I2C3_MspInit 0 */

    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    /**I2C3 GPIO Configuration
    PC9     ------> I2C3_SDA
    PA8     ------> I2C3_SCL
    */
    GPIO_InitStruct.Pin = GPIO_PIN_9;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_OD;
    GPIO_InitStruct.Pull = GPIO_PULLUP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    GPIO_InitStruct.Alternate = GPIO_AF4_I2C3;
    HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

    GPIO_InitStruct.Pin = GPIO_PIN_8;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_OD;
    GPIO_InitStruct.Pull = GPIO_PULLUP;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    GPIO_InitStruct.Alternate = GPIO_AF4_I2C3;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

    /* I2C3 clock enable */
    __HAL_RCC_I2C3_CLK_ENABLE();

    /* I2C3 interrupt Init */
    HAL_NVIC_SetPriority(I2C3_EV_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(I2C3_EV_IRQn);
  /* USER CODE BEGIN I2C3_MspInit 1 */

  /* USER CODE END I2C3_MspInit 1 */
  }
}

void HAL_I2C_MspDeInit(I2C_HandleTypeDef* i2cHandle)
{

  if(i2cHandle->Instance==I2C1)
  {
  /* USER CODE BEGIN I2C1_MspDeInit 0 */

  /* USER CODE END I2C1_MspDeInit 0 */
    /* Peripheral clock disable */
    __HAL_RCC_I2C1_CLK_DISABLE();

    /**I2C1 GPIO Configuration
    PB6     ------> I2C1_SCL
    PB7     ------> I2C1_SDA
    */
    HAL_GPIO_DeInit(GPIOB, GPIO_PIN_6);

    HAL_GPIO_DeInit(GPIOB, GPIO_PIN_7);

    /* I2C1 interrupt Deinit */
    HAL_NVIC_DisableIRQ(I2C1_EV_IRQn);
  /* USER CODE BEGIN I2C1_MspDeInit 1 */

  /* USER CODE END I2C1_MspDeInit 1 */
  }
  else if(i2cHandle->Instance==I2C2)
  {
  /* USER CODE BEGIN I2C2_MspDeInit 0 */

  /* USER CODE END I2C2_MspDeInit 0 */
    /* Peripheral clock disable */
    __HAL_RCC_I2C2_CLK_DISABLE();

    /**I2C2 GPIO Configuration
    PB10     ------> I2C2_SCL
    PB11     ------> I2C2_SDA
    */
    HAL_GPIO_DeInit(GPIOB, GPIO_PIN_10);

    HAL_GPIO_DeInit(GPIOB, GPIO_PIN_11);

    /* I2C2 interrupt Deinit */
    HAL_NVIC_DisableIRQ(I2C2_EV_IRQn);
  /* USER CODE BEGIN I2C2_MspDeInit 1 */

  /* USER CODE END I2C2_MspDeInit 1 */
  }
  else if(i2cHandle->Instance==I2C3)
  {
  /* USER CODE BEGIN I2C3_MspDeInit 0 */

  /* USER CODE END I2C3_MspDeInit 0 */
    /* Peripheral clock disable */
    __HAL_RCC_I2C3_CLK_DISABLE();

    /**I2C3 GPIO Configuration
    PC9     ------> I2C3_SDA
    PA8     ------> I2C3_SCL
    */
    HAL_GPIO_DeInit(GPIOC, GPIO_PIN_9);

    HAL_GPIO_DeInit(GPIOA, GPIO_PIN_8);

    /* I2C3 interrupt Deinit */
    HAL_NVIC_DisableIRQ(I2C3_EV_IRQn);
  /* USER CODE BEGIN I2C3_MspDeInit 1 */

  /* USER CODE END I2C3_MspDeInit 1 */
  }
}

/* USER CODE BEGIN 1 */

/* USER CODE END 1 */
