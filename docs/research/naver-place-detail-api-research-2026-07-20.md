# 네이버 장소 상세 API 조사

- 작성일: 2026-07-20
- 범위: 공개 네이버 지도 JavaScript SDK와 네이버 검색 API의 공식 문서

## 결론

**네이버 지도 JavaScript SDK는 네이버 지도 앱의 장소 상세 화면(사진·리뷰·영업시간·전화 등)을 자동으로 가져오거나 렌더하는 공개 기능을 제공하지 않는다.** SDK는 지도·마커·정보 창을 제공하며, 정보 창의 내용은 서비스가 문자열 또는 `HTMLElement`로 직접 넣어야 한다.

네이버 검색 API의 **지역 검색**을 별도로 호출하면 업체명, 분류, 설명, 주소, 좌표와 상세 URL은 얻을 수 있다. 다만 전화번호는 항상 빈 값이며, 사진·리뷰·영업시간은 응답 항목에 없다. 따라서 첨부한 네이버 지도 수준의 장소 카드는 공개 API만으로 재현할 수 없다.

## API별 제공 범위

| 구분 | 제공 | 제공하지 않음 |
| --- | --- | --- |
| 지도 JavaScript SDK | 지도, 마커, 클릭 이벤트, 정보 창, 주소↔좌표 변환 | 장소 상세 데이터, 자동 장소 카드 |
| 검색 API 지역 검색 | 장소명, 상세 URL, 분류, 설명, 지번/도로명 주소, WGS84 좌표 | 전화번호 값, 사진, 리뷰, 영업시간 |

### 지도 SDK

- `naver.maps.Service`의 공개 서버 API 호출 메서드는 주소→좌표 `geocode`와 좌표→주소 `reverseGeocode`다. 공개 레퍼런스에 장소 검색 또는 장소 상세 조회 메서드는 없다.
- `Marker`는 좌표와 아이콘·제목·클릭 이벤트를 제공한다. `title`은 마우스 오버 툴팁이다.
- `InfoWindow`는 지도 위 정보 창이며, `content`로 문자열 또는 `HTMLElement`를 전달받아 표시한다. 즉 카드 UI와 데이터는 애플리케이션이 준비해야 한다.

### 검색 API 지역 검색

- 네이버 지역 서비스에 등록된 업체·기관을 검색한다.
- 결과는 `title`, `link`(업체·기관 상세 정보 URL), `category`, `description`, `address`, `roadAddress`, `mapx`, `mapy`를 포함한다.
- `telephone`은 하위 호환성용 항목으로 값을 반환하지 않는다.
- 결과는 한 번에 최대 5건이며, 클라이언트 ID·시크릿을 HTTP 헤더로 보내야 한다. 시크릿이 필요한 호출이므로 브라우저에서 직접 호출하지 않는다.

## 제품 선택

1. 현재 이벤트에 저장한 장소명·주소를 `InfoWindow` 또는 지도 아래 카드로 보여준다.
2. 추가 자동 보강이 필요하면 서버에서 지역 검색 API를 호출해 **이름·분류·주소·네이버 상세 링크**만 채운다.
3. 사진·리뷰·영업시간까지 필요하면 별도 장소 데이터 공급원 또는 운영자 입력이 필요하다. 네이버 상세 URL은 "네이버 지도에서 보기"로 외부 이동시키는 것이 공개 API 범위 안의 최소 구현이다.

## 공식 출처

- [NAVER 지도 API v3 Service](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.Service.html) — `geocode`, `reverseGeocode` 공개 메서드
- [NAVER 지도 API v3 InfoWindow](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.InfoWindow.html) — `content`에 문자열 또는 `HTMLElement`를 넣는 정보 창
- [NAVER 지도 API v3 Marker](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.Marker.html) — 마커의 좌표·아이콘·툴팁·클릭 이벤트
- [네이버 검색 API: 지역 검색](https://developers.naver.com/docs/serviceapi/search/local/local.md) — 지역 검색 응답 필드 및 `telephone` 미반환 명세
