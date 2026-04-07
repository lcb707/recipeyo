import logging
from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from smtplib import SMTPException

logger = logging.getLogger('backend')

@shared_task(
    bind=True,
    max_retries=3,
    soft_time_limit=60,  # 1분 안에 안 끝나면 강제 종료 예고
    time_limit=70        # 70초 지나면 강제 종료
)
def send_verification_email_task(self, email, code):
    """
    고도화된 비동기 이메일 발송 작업
    """
    subject = "[서비스명] 회원가입을 위한 인증 번호입니다."
    from_email = settings.DEFAULT_FROM_EMAIL
    
    context = {
        'code': code,
        'user_email': email,
        'expire_minutes': 5
    }
    
    try:
        html_content = render_to_string('emails/verification.html', context)
        text_content = strip_tags(html_content)  # HTML 미지원 클라이언트용 텍스트

        # 2. EmailMultiAlternatives 사용 (HTML + Text 조합)
        msg = EmailMultiAlternatives(subject, text_content, from_email, [email])
        msg.attach_alternative(html_content, "text/html")
        
        msg.send(fail_silently=False)
        
        #logger.info(f"Email sent successfully: To={email}")
        return f"SUCCESS: {email}"

    except SMTPException as e:
        # SMTP 관련 에러 (인증, 서버 다운 등) 시 지수 백오프 재시도
        # 재시도 간격: 2^retries * 300초
        wait_time = (2 ** self.request.retries) * 300 
        logger.warning(
            "SMTP error in send_verification_email_task. retry_in=%ss exception_type=%s",
            wait_time,
            type(e).__name__,
        )
        raise self.retry(exc=e, countdown=wait_time)
        
    except Exception as e:
        # 비즈니스 로직 에러 (템플릿 없음 등)는 재시도 없이 즉시 로그 기록
        logger.error(
            "Critical error in send_verification_email_task. exception_type=%s",
            type(e).__name__,
            exc_info=True,
        )
        raise