# 차량 원격 계측 시스템

### 폴더 구조
* device: 임베디드 MCU 펌웨어
    * ECU: 차량 데이터 수집 STM32F4 STM32CubeIDE 프로젝트
    * ESP: 서버 소켓 통신 ESP32 아두이노 프로젝트
* server: 원격 계측 서버(Node.js)
* web: 원격 계측 모니터링 웹 어플리케이션 프론트엔드

## 서비스 URL
* [A-FA E-포뮬러 원격 계측](https://a-fa.luftaquila.io/telemetry)

## E-Formula ECU
Platform: **ARM Cortex-M4 [STM32F407VET](https://stm32-base.org/boards/STM32F407VET6-STM32-F4VE-V2.0.html#User-LED-1)**  
Source: https://github.com/luftaquila/a-fa  
version 1: [main_v1.c](https://github.com/luftaquila/a-fa/blob/master/telemetry/device/ECU/Core/Src/main.c)

### References
* [[STM32 HAL] Timer# Basic 타이머](https://blog.naver.com/eziya76/221451890046)
* [STM32 Timer Calculator](https://docs.google.com/spreadsheets/d/17yXEabpYRc4yG0aumSw9E4wj_zMZQmvcvQUI3M-oMEg/edit#gid=0)
* [STM32 HAL I2C TRULY NON-BLOCKING MEMORY I/O](https://gist.github.com/HTD/e36fb68488742f27a737a5d096170623)
* [How to test if your CAN termination works correctly](https://www.kvaser.com/developer-blog/how-to-test-your-can-termination-works-correctly/)
* [SD with DMA works, except in callback](https://community.st.com/s/question/0D50X00009sW0ZCSA0/sd-with-dma-works-except-in-callback)

## To-Do
1. ESP32 implementation
3. LCD update using CAN data
4. `sys_state` and LED manipulation
5. [Ring Buffer Overflow detection](https://github.com/djherbis/buffer/issues/6#issuecomment-293133478)

## Features
* SD card data logging
* CAN bus traffic monitoring
* Telemetry over wireless network via ESP32
* Dashboard 1602 LCD display control
* Sensing
    * Digital signals
        * RTD ACTIVE
        * HV ACTIVE
        * BMS FAULT
        * IMD FAULT
        * BSPD FAULT

    * Analog signals
        * CPU temperature x1
        * Wheel speed sensor x4
        * Suspension distance sensor x4

    * Sensors
        * ADXL345 accelerometer
        * NEO-7M GPS

## Log structure (16 Byte)
* timestamp (#0 ~ #3)
* level (#4)
* source (#5)
* key (#6)
* reserved (#7)
* VALUE (#8 ~ #15)
