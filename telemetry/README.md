# 차량 원격 계측 시스템
E-Formula의 원격 계측 시스템 코드 저장소입니다.

다음은 각 디렉토리별 내용입니다.

* `device`: 임베디드 MCU 코드
    * `ECU`: 차량 제어용 STM32F407 펌웨어 STM32CubeIDE 프로젝트  
      * `ECU.ioc`: ECU의 클럭 설정과 GPIO 구성, 통신 인터페이스 및 파일시스템 미들웨어 설정  
      * `Core/Src/main.c`: ECU 펌웨어 소스 코드  
    * `ESP`: 원격 계측 서버와의 소켓 통신을 담당하는 ESP8266 펌웨어
    
* `server`: 원격 계측 서버 (Node.js)  
   * `index.mjs`: Node.js 서버 소스 코드
   
* `web`: 원격 계측 모니터링 웹 어플리케이션 프론트엔드 HTML5
  
## 외부 링크
* [E-포뮬러 전기시스템 제작기](https://luftaquila.io/blog/e-formula/)
* [A-FA E-포뮬러 원격 계측](https://a-fa.luftaquila.io/telemetry)
