# 부산 맛집 정보 서비스 App

부산시 공공데이터의 **부산맛집정보 서비스(FoodService) OpenAPI**를 이용한 HTML/CSS/JavaScript 프로젝트다.

## 1. 폴더 구조

```text
busan-food-app/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  └─ app.js
└─ README.md
```

## 2. 구현된 PRD 기능

- HOME / 맛집 / 지도 / MY 4개 탭
- 부산맛집 OpenAPI 호출
- API 응답 `console.log()` 확인
- 맛집 카드 목록
- 맛집명·메뉴·주소·지역 검색
- 부산 구·군별 필터
- 상세정보 모달
- 전화하기
- 홈페이지 연결
- 지도 및 맛집 마커
- 현재 위치 보기
- 즐겨찾기(LocalStorage)
- 최근 본 맛집(LocalStorage)
- 더보기 / 페이지 처리
- 한국어·영어·일본어·중국어 API endpoint 전환
- 로딩 UI
- API 오류 UI
- 이미지 오류 fallback
- 모바일 우선 반응형 디자인

## 3. API Key 입력 위치

`js/app.js` 파일 상단의 아래 값을 수정한다.

```javascript
const API_CONFIG = {
  baseUrl: "https://apis.data.go.kr/6260000/FoodService",

  apiKey: "YOUR_BUSAN_API_KEY",
};
```

`YOUR_BUSAN_API_KEY`를 공공데이터포털에서 발급받은 실제 ServiceKey로 교체한다. Encoding Key 또는 Decoding Key 어느 쪽을 입력해도 코드에서 이중 인코딩을 방지하도록 처리했다.

## 4. API Key 입력 전

API Key가 없더라도 UI와 기능을 확인할 수 있도록 샘플 데이터가 자동으로 표시된다.

실제 API Key를 입력하면 샘플 데이터 대신 OpenAPI 데이터를 사용한다.

## 5. 실행 방법

VS Code에서 프로젝트 폴더를 연 후 **Live Server** 사용을 권장한다.

```text
index.html → 우클릭 → Open with Live Server
```

또는 다른 로컬 웹서버로 실행한다.

## 6. 개발자 도구에서 API 확인

브라우저에서 `F12`를 누르고 Console을 확인한다.

정상 호출 시 다음 로그가 표시된다.

```text
서버 응답 객체:
HTTP Status:
부산맛집 OpenAPI 원본 데이터:
API 결과 코드:
API 결과 메시지:
맛집 목록 데이터:
맛집 데이터 개수:
첫 번째 맛집 데이터:
화면 출력 예정 데이터:
```

오류 발생 시:

```text
부산맛집 API 호출 오류:
```

가 표시된다.

## 7. 중요 참고

원본 활용가이드에는 서비스 기본 주소가 `http://apis.data.go.kr/...` 형식으로 기재되어 있다.

HTTPS 사이트에 배포할 경우 브라우저의 Mixed Content 정책으로 HTTP API 호출이 제한될 수 있다. 실제 배포 환경에서는 공공데이터포털의 현재 호출 주소와 HTTPS 지원 여부를 확인하거나 서버/Proxy 구성을 검토해야 한다.

## 8. 지도

지도는 **Kakao Map JavaScript API**만 사용한다.

맛집 OpenAPI의 `LAT`, `LNG` 값을 `kakao.maps.LatLng()`으로 변환해 마커에 사용한다.

`index.html` 하단의 다음 값을 본인의 Kakao Developers JavaScript Key로 변경한다.

```html
<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KAKAO_JAVASCRIPT_KEY&libraries=services"></script>
```

Kakao Developers의 웹 플랫폼에 실제 실행 도메인도 등록해야 한다.

## 9. 다국어 endpoint

```text
getFoodKr  → 한국어
getFoodEn  → 영어
getFoodJa  → 일본어
getFoodZhs → 중국어 간체
getFoodZht → 중국어 번체
```

화면 우측 상단 언어 선택 메뉴에서 전환한다.

## 10. LocalStorage 키

```text
busanFoodFavorites
busanFoodRecent
```

브라우저 저장소를 초기화하면 즐겨찾기와 최근 본 맛집도 삭제된다.

## 데이터 로딩 오류 수정 사항

이번 수정본은 다음 문제를 보완했다.

1. API 호출 주소를 HTTPS 우선으로 사용한다.
2. 공공데이터포털의 Encoding ServiceKey를 `URLSearchParams`가 다시 인코딩하는 문제를 방지한다.
3. 서버 응답을 `response.json()`으로 바로 읽지 않고 `response.text()`로 먼저 확인한다.
4. 서버가 JSON을 반환하면 JSON으로, XML을 반환하면 DOMParser로 자동 파싱한다.
5. Console에서 Response, HTTP Status, Content-Type, 원본 응답 문자열, 파싱 데이터, 맛집 배열, 첫 번째 맛집을 모두 확인할 수 있다.
6. `Failed to fetch` 발생 시 CORS/Mixed Content/활용신청/ServiceKey 확인 안내를 화면에 표시한다.

### 중요

`index.html`을 파일 더블클릭(`file://`)으로 실행하지 말고 VS Code Live Server 같은 로컬 웹서버에서 실행한다.

```text
http://127.0.0.1:5500/...
또는
http://localhost:5500/...
```

Kakao Map도 Kakao Developers의 웹 플랫폼 사이트 도메인에 실행 주소를 등록해야 한다.
