# Server·Client Component 규칙

App Router에서는 Server Component를 기본으로 사용하고, 브라우저 상호작용이 필요한 최소 영역만 Client Component로 둔다.

## Client 경계를 두는 경우

- useState, useReducer
- onClick, onChange 같은 이벤트 핸들러
- useEffect와 생명주기 로직
- window, localStorage, navigator 같은 브라우저 API
- Client 전용 custom hook

페이지나 큰 layout 전체에 use client를 붙이기 전에 자식 영역으로 내릴 수 있는지 확인한다. 경계를 줄인다는 이유로 이해하기 어려운 파일 분리를 만들지 않는다.

## 데이터와 보안

- Server → Client props는 React가 직렬화할 수 있는 값만 전달한다.
- DB connection, Request 객체, 일반 함수, 사용자 정의 class instance와 비밀값을 전달하지 않는다.
- NEXT_PUBLIC_ 접두사가 없는 환경변수와 API key는 Client Component에서 참조하지 않는다.
- Client에서 직접 DB나 비밀 API를 호출하지 않고 서버 경계를 거친다.
- localStorage를 사용하는 상태는 Client Component에서만 사용한다.

## Provider와 조합

Context Provider는 Client Component로 만들고 실제로 필요한 하위 트리만 감싼다. Client Component가 서버 컴포넌트를 직접 import하는 방식으로 경계를 우회하지 말고, 필요한 경우 서버에서 children 슬롯으로 조합한다.

## 검수 질문

- 이 파일에 정말 상태·이벤트·브라우저 API가 필요한가?
- use client를 자식으로 내릴 수 있는가?
- props가 직렬화 가능한가?
- 서버 전용 코드와 비밀값이 Client bundle에 들어가지 않는가?
