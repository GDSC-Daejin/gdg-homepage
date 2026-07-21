# 네이버 지도 앱 딥링크 조사

- 작성일: 2026-07-20
- 범위: 네이버 클라우드의 네이버 지도 앱 URL Scheme 공식 문서만 확인

## 결론

네이버 지도는 모바일 웹에서 호출할 수 있는 공식 앱 URL Scheme을 제공한다. 다만 공식 문서가 보장하는 미설치 폴백은 **웹 지도**가 아니라 앱 스토어다. 따라서 "설치되어 있으면 네이버 지도 앱, 설치되어 있지 않으면 네이버 지도 웹"이라는 자동 분기는 공식 지원 URL 하나로는 구현할 수 없다.

| 경우 | 공식 지원 동작 |
| --- | --- |
| 설치된 앱에서 장소 검색 | `nmap://search`로 네이버 지도 앱 검색 결과 표시 |
| 설치된 앱에서 좌표 표시 | `nmap://place`로 지정 좌표에 마커 표시 |
| Android 모바일 웹에서 앱 미설치 | `intent://` 형식 사용 시 Google Play로 자동 이동 |
| iOS 모바일 웹에서 앱 미설치 | JavaScript 타이머로 App Store 이동을 별도 구현 |
| 앱 미설치 시 네이버 지도 **웹** 자동 이동 | 공식 문서에 지원 방식 없음 |

## 사용할 URI

모든 네이버 지도 앱 URI에는 호출자를 식별하는 `appname`이 필수다. 모바일 웹에서는 현재 웹 페이지 URL을 넣는다.

### 장소명으로 검색

장소명 또는 도로명 주소가 있을 때는 검색 액션이 적합하다. `query`는 URL 인코딩한다.

```
nmap://search?query={encodeURIComponent(장소명_또는_주소)}&appname={현재_웹_페이지_URL}
```

공식 문서는 `/search`를 지도 통합 검색 결과를 표시하는 액션으로 정의한다. 이는 특정 네이버 플레이스 ID의 상세 카드(리뷰·사진 등)를 직접 여는 공개 액션은 아니다.

### 좌표에 마커 표시

좌표와 장소명이 있다면 다음 URI로 지도 앱의 마커를 표시할 수 있다.

```
nmap://place?lat={위도}&lng={경도}&name={encodeURIComponent(장소명)}&appname={현재_웹_페이지_URL}
```

`/place`는 마커 표시 기능이다. 네이버 지도 앱의 장소 상세 화면을 여는 기능으로 문서화되어 있지 않다.

### Android 모바일 웹

Android에서는 `intent://` 형식을 써야 설치된 앱을 열고, 앱이 없으면 Google Play로 자동 이동한다.

```
intent://search?query={encodeURIComponent(장소명_또는_주소)}&appname={현재_웹_페이지_URL}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end
```

## iOS 및 미설치 제약

- 모바일 웹의 `nmap://` 호출은 네이버 지도 앱이 설치되어 있어야 한다.
- Android의 공식 `intent://` 폴백은 Google Play다. 문서에는 웹 URL 폴백 파라미터가 없다.
- iOS 모바일 웹은 앱 설치 여부를 직접 확인하는 API를 제공하지 않는다. 네이버 문서는 URL Scheme 호출 뒤 JavaScript 타이머로 App Store 이동을 처리하는 방식만 안내한다.
- 그러므로 타이머·`visibilitychange`로 일정 시간 뒤 현재의 지도 웹 링크로 보내는 방식은 만들 수는 있어도, 앱 실행 여부를 추정하는 비공식 동작이다. iOS의 지연·오류 팝업 및 인앱 브라우저에 따른 오동작을 감수해야 한다.

## 현재 화면에 대한 권장 결정

현재 `EventLocation`은 아래 브라우저 URL을 사용한다.

```
https://map.naver.com/p/search/{encodeURIComponent(address)}
```

이 URL은 일반 웹 이동으로 그대로 유지할 수 있다. 다만 네이버가 공개 문서에서 "앱이 있으면 앱, 없으면 웹"을 보장하는 Universal Link로 명세한 URL은 아니다.

따라서 안정성을 우선하면 다음 중 하나를 선택한다.

1. **웹 우선:** 현행 웹 링크를 유지한다. 앱으로의 자동 전환은 보장하지 않는다.
2. **앱 우선:** 모바일에서 Android `intent://search` 및 iOS `nmap://search`를 사용한다. 미설치 사용자는 각 스토어로 보낸다.
3. **제품 요구 우선(비공식):** 앱 Scheme을 먼저 시도하고 일정 시간 뒤 현행 웹 URL로 폴백한다. 이는 공식 지원 범위 밖이므로 실기기 iOS/Android 및 인앱 브라우저 검증이 필요하다.

## 공식 출처

- [네이버 지도 앱 연동 URL Scheme](https://guide.ncloud-docs.com/docs/maps-url-scheme) — `nmap://` 구문, `appname` 필수, 모바일 웹 Android/iOS 처리, `/search`·`/place` 액션 명세
- [NAVER Maps app URL Scheme (English)](https://guide.ncloud-docs.com/docs/en/maps-url-scheme) — 동일 문서의 영문판; Android Intent·iOS 타이머 예제 확인용
