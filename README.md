# 아주대학교 기계공학과 자작자동차소학회 A-FA
경주용 전기자동차 E-Formula의 전기시스템 파트 코드 및 회로도입니다. 

* `device`: 임베디드 MCU 코드
    * `ECU`: 차량 제어용 STM32F407의 STM32CubeIDE 프로젝트 코드
    * `ESP`: 원격 계측 서버와의 소켓 통신을 담당하는 ESP8266 코드
* `schematics`: 차량 전기시스템 계통 전체의 KiCAD 회로도
* `server`: 원격 계측 서버(Node.js)
* `web`: 원격 계측 모니터링 웹 어플리케이션 프론트엔드
  
## 외부 링크
* [E-포뮬러 전기시스템 제작기](https://luftaquila.io/blog/e-formula/)
* [A-FA E-포뮬러 원격 계측](https://a-fa.luftaquila.io/)
