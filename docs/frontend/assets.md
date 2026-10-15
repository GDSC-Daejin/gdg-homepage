# 폰트·이미지 관리

폰트·이미지는 접근성·보안·레이아웃 안정성을 우선한다. 특정 이미지 도구나 CDN 도입 자체는 완료 조건이 아니다.

## 현재 프로젝트 기준

- 본문과 UI 폰트는 Pretendard Variable을 사용한다.
- Pretendard는 현재 src/app/pretendard-subset.css와 pretendard 패키지의 dynamic subset을 사용한다. 폰트가 관련 없는 작업에서 next/font/local로 마이그레이션하지 않는다.
- 폰트 설정은 src/app의 전역 스타일·레이아웃 경계를 따른다.
- 사이트 URL은 NEXT_PUBLIC_SITE_URL을 사용한다. 도메인을 코드에 하드코딩하지 않는다.

## 이미지

- 화면에 표시하는 이미지는 next/image를 우선한다.
- 이미지에는 표시 크기 또는 반응형 sizes를 명시한다.
- 정보성 이미지는 의미 있는 alt를, 장식용 이미지는 빈 alt를 사용한다.
- 크기를 예약해 레이아웃 이동을 줄인다.
- 외부 이미지는 next.config.ts의 허용 범위 안에서만 사용한다.
- 안정적인 프로젝트 asset은 public/에 두고, 특정 기능에만 속한 asset은 해당 app·component 경계에 둔다.
- 만료되는 원격 디자인 asset URL이나 민감한 사용자 데이터를 커밋하지 않는다.
- 이미지가 없다는 이유만으로 임의 placeholder를 추가하지 않는다.
