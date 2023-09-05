# 차량 원격 계측 시스템

상위 프로젝트: [luftaquila/a-fa-landing](https://github.com/luftaquila/a-fa-landing)

### 기능
1. CAN 버스 트래픽 모니터링 (BMS 및 모터 컨트롤러 데이터)
2. 6채널 디지털 입력 신호 모니터링 (BMS / BSPD / IMD 오류, HV 활성화, RTD 활성화 신호)
3. 4채널 아날로그 입력 신호 모니터링 (서스펜션 변위 센서)
4. 4채널 디지털 펄스 모니터링 (휠 스피드 센서)
5. 3축 가속도 센서 데이터(I2C)
6. GPS 위치 정보(UART)
7. 자체 CPU 온도 모니터링
8. 무선 시간 동기화 및 RTC를 통한 시간 정보 유지
9. 드라이버 계기판 LCD 시현(I2C)
10. 수집한 데이터의 SD카드 로깅(SDIO/FATFS)
11. 수집한 데이터의 실시간 무선 인터넷 전송

### 디렉터리 구조
* device: 임베디드 MCU 펌웨어
    * ECU: 차량 데이터 수집용 STM32F4 STM32CubeIDE 프로젝트
    * ESP: 서버 소켓 통신용 ESP32 아두이노 프로젝트
* server: 원격 계측 서버 백엔드(Node.js)
* web: 원격 계측 모니터링 웹 어플리케이션 프론트엔드

### 회로도 및 PCB
[설계 파일](https://github.com/luftaquila/a-fa-schematics/tree/master/PCBs/LV_PCB%20v2)

![image](https://github.com/luftaquila/a-fa-telemetry/assets/17094868/9cb01289-a283-4500-81a1-3442ea2228ec)
![image](https://github.com/luftaquila/a-fa-telemetry/assets/17094868/0800098a-1391-47b6-912d-b4a601f2d27d)

## 서비스 URL
* [A-FA E-포뮬러 원격 계측 시스템](https://a-fa.luftaquila.io/telemetry)

![screencapture-a-fa-luftaquila-io-telemetry-2023-08-26-16_22_42](https://github.com/luftaquila/a-fa-telemetry/assets/17094868/7f5d1325-e314-4a54-927a-87ae08ecbfc2)

![image](https://github.com/luftaquila/a-fa-telemetry/assets/17094868/b007af26-b12d-4942-88ab-b200da300190)

## Log structure (16 Byte)
```c
typedef struct {
  uint32_t timestamp;
  uint8_t level;
  uint8_t source;
  uint8_t key;
  uint8_t _reserved;
  uint8_t value[8];
} LOG;
```
