# AWS 풀스택 전환 학습 가이드

> 상태: 학습용 참고 자료
>
> 이 문서는 GDGOC DJU 서비스를 AWS 기반으로 다시 만든다고 **가정했을 때의 권장 스택**을 설명합니다. 실제 구현·마이그레이션·인프라 변경 계획은 없습니다.

## 전제

- 현재 Next.js와 Supabase가 맡는 인증, 데이터베이스, 파일 저장, 정기 작업을 AWS와 자체 백엔드로 대체한다고 가정한다.
- 백엔드는 Java와 Spring Boot를 사용한다.
- 운영 서비스이므로 이벤트 신청, 출석, 포인트, 봇, 일정처럼 동시 쓰기와 권한 검사가 필요한 기능을 고려한다.

## 권장 구조

```text
사용자
  ↓ Route 53 / CloudFront
ALB
  ├─ /      → ECS Fargate: Next.js
  └─ /api/* → ECS Fargate: Spring Boot API
                  ├─ RDS PostgreSQL
                  ├─ Cognito
                  ├─ S3
                  └─ Secrets Manager

EventBridge Scheduler → 별도 ECS Fargate 작업
                       (봇, 알림, 일일 집계)
```

## 스택 요약

| 영역 | 추천 | 역할 |
|---|---|---|
| 웹 | Next.js App Router | 화면 렌더링과 사용자 경험 |
| 백엔드 | Java + Spring Boot | API, 도메인 규칙, 권한 검사 |
| 인증 | Amazon Cognito + Spring Security JWT | Google 로그인과 토큰 검증 |
| DB | Amazon RDS PostgreSQL | 회원, 이벤트, 출석, 포인트 등 영속 데이터 |
| ORM | JPA/Hibernate | 일반적인 도메인 CRUD |
| 복잡한 SQL·집계 | jOOQ 또는 JdbcTemplate | 통계, 잠금, 복잡한 조회와 갱신 |
| 마이그레이션 | Flyway | DB 스키마 변경 이력 관리 |
| 실행 환경 | Docker + ECS Fargate | Next.js와 API 컨테이너 실행 |
| 트래픽 | ALB + CloudFront | HTTPS 요청 분산과 캐시 |
| 파일 | S3 + presigned URL | 프로필 사진과 첨부 파일 업로드 |
| 정기 작업 | EventBridge Scheduler + 별도 Fargate Task | 봇, 알림, 일일 집계의 중복 실행 방지 |
| 비밀값 | Secrets Manager | DB 비밀번호, Slack·Google 연동 키 보관 |
| 로그·알림 | CloudWatch Logs / Alarms | 장애 확인과 운영 알림 |
| 배포 | GitHub Actions → ECR → ECS | 이미지 빌드와 배포 자동화 |
| 인프라 | Terraform 또는 CDK | AWS 리소스를 코드로 관리 |

## 왜 PostgreSQL인가

이 서비스는 회원별 접근 권한, 이벤트 신청 인원 제한, 출석·포인트 집계처럼 데이터베이스 수준의 무결성이 중요하다. PostgreSQL은 트랜잭션, 잠금, 함수, 트리거, 행 단위 권한 정책을 폭넓게 지원한다.

- **PostgreSQL**: 이 서비스의 권한·집계·동시성 요구에 가장 적합하다.
- **MySQL**: Spring Boot의 일반 CRUD 서비스에는 적합하지만, 현재와 같은 세밀한 데이터 권한과 복잡한 DB 규칙은 애플리케이션 코드로 더 많이 옮겨야 한다.
- **SQLite**: 로컬 개발이나 단일 사용자 도구에는 좋지만, 여러 사용자가 동시에 이벤트 신청·출석·봇 인증을 하는 운영 DB에는 적합하지 않다.

## 요청 흐름 예시

### 로그인과 API 호출

1. 사용자가 Cognito로 Google 로그인을 한다.
2. Next.js가 받은 JWT를 Spring Boot API에 전달한다.
3. Spring Security가 JWT를 검증한다.
4. API가 역할과 본인 여부를 확인한 뒤 RDS PostgreSQL을 조회하거나 변경한다.

### 파일 업로드

1. 웹이 API에 업로드 권한을 요청한다.
2. API가 짧은 유효기간의 S3 presigned URL을 발급한다.
3. 브라우저가 S3에 파일을 직접 올린다.
4. API에는 파일 경로나 메타데이터만 저장한다.

### 정기 작업

1. EventBridge Scheduler가 정해진 시간에 Fargate Task를 시작한다.
2. 작업이 봇 메시지 발송, 포인트 집계 또는 알림 발송을 수행한다.
3. 작업 결과와 중복 실행 방지 기록을 PostgreSQL에 남긴다.

API 서버 내부의 스케줄러로 정기 작업을 실행하면 API 컨테이너가 여러 개일 때 중복 실행될 수 있다. 그래서 정기 작업은 별도 Task로 분리한다.

## 처음부터 넣지 않는 것

학습용 권장 구성에서도 아래 항목은 실제 병목이 확인된 뒤 도입하는 편이 낫다.

- **Redis/ElastiCache**: 캐시, 분산락, 세션 병목이 생길 때
- **SQS**: 이메일·Slack 작업이 많아져 API와 비동기 처리 분리가 필요할 때
- **Aurora PostgreSQL**: RDS PostgreSQL의 성능·가용성 요구를 넘을 때
- **복잡한 마이크로서비스 분리**: 하나의 Spring Boot 서비스가 감당하기 어려워질 때

## 보안 기본 원칙

- RDS는 public subnet에 두지 않고 API에서만 접근하게 한다.
- AWS 접근 권한은 장기 액세스 키 대신 ECS Task Role로 부여한다.
- DB 비밀번호와 외부 연동 키는 코드나 GitHub Secrets에 직접 두지 않고 Secrets Manager에서 주입한다.
- API는 모든 데이터 변경 전에 인증, 역할, 대상 리소스의 소유권을 확인한다.
- EventBridge 작업은 재시도와 실패 알림을 설정하고, DB 고유 제약으로도 중복 실행을 막는다.

## 학습 순서 제안

1. Spring Boot로 간단한 회원·이벤트 CRUD API를 만든다.
2. PostgreSQL과 Flyway로 스키마를 관리한다.
3. Spring Security JWT 인증을 붙인다.
4. Docker로 API를 컨테이너화한다.
5. RDS PostgreSQL과 ECS Fargate에 배포해 본다.
6. S3 presigned URL 파일 업로드를 붙인다.
7. EventBridge Scheduler로 간단한 정기 작업을 실행한다.

각 단계는 학습용 실습으로 독립해서 진행할 수 있다. 이 문서는 실제 서비스 전환의 승인된 계획이나 일정이 아니다.
