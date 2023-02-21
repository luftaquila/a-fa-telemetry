/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * E-Formula 2023 ECU Unit Firmware. A-FA, Ajou University, Korea.
  *
  * Oh Byung-Jun (mail@luftaquila.io)
  * A-FA E-Formula Electric System Part Manager & Team Project Manager
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
#include "logger.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
extern int32_t SYS_LOG(LOG_LEVEL level, LOG_SOURCE source, int32_t key);
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */
/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

/* USER CODE BEGIN PV */
ERROR_CODE err;

FIL logfile;
LOG syslog;

uint32_t timer_flag = 0;
uint32_t adc_flag = 0;
uint32_t adc_value[ADC_COUNT] = { 0, };

uint32_t i2c_buffer_flag = 0;
ring_buffer_t ESP_BUFFER;
ring_buffer_t LCD_BUFFER;

SYSTEM_STATE sys_state;

DISPLAY_DATA display_data;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
/* USER CODE BEGIN PFP */
int32_t ECU_SETUP(void);
/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */
int _write(int file, uint8_t *ptr, int len) {
  HAL_UART_Transmit(&huart1, (uint8_t *)ptr, (uint16_t)len, 50);
  return (len);
}
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
  MX_USART1_UART_Init();
  MX_I2C2_Init();
  MX_SDIO_SD_Init();
  MX_RTC_Init();
  MX_FATFS_Init();
  MX_ADC1_Init();
  MX_I2C1_Init();
  MX_CAN1_Init();
  MX_ADC2_Init();
  MX_ADC3_Init();
  MX_USART2_UART_Init();
  MX_TIM1_Init();
  MX_I2C3_Init();
  MX_TIM2_Init();
  MX_TIM3_Init();
  /* USER CODE BEGIN 2 */

  int32_t ret;
  uint64_t boot = RTC_read();

  // init ECU gpio and system state
  ret = ECU_SETUP();
  if (ret != 0) {
    #ifdef DEBUG_MODE
      printf("[%8lu] [ERR] ECU setup failed: %d\r\n", HAL_GetTick(), ret);
    #endif
    err = ERR_ECU;
    Error_Handler();
  }

  // init SD card
  ret = SD_SETUP(boot);
  if (ret != 0) {
    #ifdef DEBUG_MODE
      printf("[%8lu] [ERR] SD setup failed: %d\r\n", HAL_GetTick(), ret);
    #endif
      err = ERR_SD;
      Error_Handler();
  }

  // core system boot complete
  syslog.value[0] = true;
  SYS_LOG(LOG_INFO, ECU, ECU_BOOT);


  // init ESP32 i2c for remote telemetry
  ret = ESP_SETUP();
  if (ret != 0) {
    #ifdef DEBUG_MODE
      printf("[%8lu] [ERR] ESP setup failed: %d\r\n", HAL_GetTick(), ret);
    #endif
    syslog.value[0] = false;
    SYS_LOG(LOG_ERROR, ESP, ESP_INIT);
  }
  syslog.value[0] = true;
  SYS_LOG(LOG_INFO, ESP, ESP_INIT);


  // init internal ADCs for sensors
  ret = ANALOG_SETUP();
  if (ret != 0) {
    #ifdef DEBUG_MODE
      printf("[%8lu] [ERR] ANALOG setup failed: %d\r\n", HAL_GetTick(), ret);
    #endif
    syslog.value[0] = false;
    SYS_LOG(LOG_ERROR, ANALOG, ADC_INIT);
  }
  syslog.value[0] = true;
  SYS_LOG(LOG_INFO, ANALOG, ADC_INIT);

/*
  // init CAN for BMS and inverter
  CAN_SETUP();


  // init ADXL345 3-axis accelerometer i2c
  ACC_SETUP();
*/

  // init 1602 LCD i2c
  ret = LCD_SETUP();
  if (ret != 0) {
    #ifdef DEBUG_MODE
      printf("[%8lu] [ERR] LCD setup failed: %d\r\n", HAL_GetTick(), ret);
    #endif
    syslog.value[0] = false;
    SYS_LOG(LOG_ERROR, LCD, LCD_INIT);
  }
  syslog.value[0] = true;
  SYS_LOG(LOG_INFO, LCD, LCD_INIT);

/*
  // init NEO-6M GPS UART
  GPS_SETUP();
 */


  // start hardware timers
  HAL_TIM_Base_Start_IT(&htim1);
  HAL_TIM_Base_Start_IT(&htim2);
  HAL_TIM_Base_Start_IT(&htim3);


  // system setup sequence complete
  syslog.value[0] = true;
  SYS_LOG(LOG_INFO, ECU, ECU_READY);

  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */

  while (1) {

    // 1s timer set - SD card sync
    if (timer_flag & 0x1 << TIMER_1s) {
      timer_flag &= ~(1 << TIMER_1s); // clear 1s timer flag

      // SD sync
      ret = SD_SYNC(&logfile);
      #ifdef DEBUG_MODE
        printf("[%8lu] [INF] SD SYNC: %d\r\n", HAL_GetTick(), ret);
      #endif
    }


    // 300ms timer set - system state record, LCD update
    if (timer_flag & 0x1 << TIMER_300ms) {
      timer_flag &= ~(1 << TIMER_300ms); // clear 300ms timer flag

      // update system state
      sys_state.HV = HAL_GPIO_ReadPin(GPIOD, HV_ACTIVE_Pin);
      sys_state.RTD = HAL_GPIO_ReadPin(GPIOD, RTD_ACTIVE_Pin);
      sys_state.BMS = HAL_GPIO_ReadPin(GPIOD, BMS_FAULT_Pin);
      sys_state.IMD = HAL_GPIO_ReadPin(GPIOD, IMD_FAULT_Pin);
      sys_state.BSPD = HAL_GPIO_ReadPin(GPIOD, BSPD_FAULT_Pin);

      *(SYSTEM_STATE *)syslog.value = sys_state;
      SYS_LOG(LOG_INFO, ECU, ECU_STATE);


      // update LCD
      LCD_UPDATE(display_data);
      syslog.value[0] = true;
      SYS_LOG(LOG_INFO, LCD, LCD_UPDATED);
    }


    // 100ms timer set - ADC conversion, accelerometer record
    if (timer_flag & 0x1 << TIMER_100ms) {
      timer_flag &= ~(1 << TIMER_100ms); // clear 100ms timer flag

      // start ADC conversion
      HAL_ADC_Start_IT(&hadc1);
      HAL_ADC_Start_IT(&hadc2);
      HAL_ADC_Start_IT(&hadc3);

      // read ACC
      // !!!!!!!!!!!!!!!!!!!!!

    }


    // on all ADC conversion complete
    if (adc_flag == ((1 << ADC_CPU) | (1 << ADC_DIST) | (1 << ADC_SPD))) {
      adc_flag = 0; // clear all adc flags

      // record each channel
      for (int i = 0; i < ADC_COUNT; i++) {
        *(uint32_t *)syslog.value = adc_value[i];
        SYS_LOG(LOG_INFO, ANALOG, i);
      }
    }


    // check I2C Tx buffer
    if (i2c_buffer_flag) {
      if (i2c_buffer_flag & (1 << I2C_BUFFER_ESP)) {
        // pending??? !!!!!!!!

      }

      else if (i2c_buffer_flag) & (1 << I2C_BUFFER_LCD)) {

      }

    }

    // CAN handling
    // GPS handling
    // !!!!!!!!!!!!!!!!!!!!!

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
int32_t ECU_SETUP(void) {

  // init LEDs
  HAL_GPIO_WritePin(GPIOA, LED00_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOA, LED01_Pin, GPIO_PIN_SET);

  HAL_GPIO_WritePin(GPIOE, LED0_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOE, LED1_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOE, LED2_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOE, LED3_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOE, LED4_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(GPIOE, LED5_Pin, GPIO_PIN_RESET);

  // init system state
  sys_state.SD = false;
  sys_state.CAN = false;
  sys_state.ACC = false;
  sys_state.LCD = false;
  sys_state.GPS = false;

  return 0;
}
/* USER CODE END 4 */

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  // __disable_irq();

  printf("[%8lu] [ERR] Error code: %d\n", HAL_GetTick(), err);

  while (1) {
    HAL_GPIO_WritePin(GPIOA, LED00_Pin, GPIO_PIN_SET);
    HAL_GPIO_WritePin(GPIOA, LED01_Pin, GPIO_PIN_RESET);
    HAL_Delay(500);
    HAL_GPIO_WritePin(GPIOA, LED00_Pin, GPIO_PIN_RESET);
    HAL_GPIO_WritePin(GPIOA, LED01_Pin, GPIO_PIN_SET);
    HAL_Delay(500);
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
