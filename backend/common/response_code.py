from rest_framework import status

class ResponseCode:
    class ErrorCode:
        # 성공
        Success = 0
        Failed = 1

        # 150~: 공통/시스템 에러
        CommonErrorStart = 150
        ApiNotFound = 151
        ServerError = 152
        
        # 200~: 인증/보안 에러
        TokenInvalid = 201
        TokenBlacklisted = 202
        PermissionDenied = 203
        AuthenticationFailed = 204
        ExpiredVerificationCode = 205
        InvalidVerificationCode = 206
        
        # 300~: 유저 관련 비즈니스 에러
        UserNotFound = 301
        Duplicate = 302
        InputAreaInvalid = 303
        DuplicateEmail = 352
        DuplicateNickname = 353
        InternalServerError = 500

        
    class HttpStatusCode:
        Success = status.HTTP_200_OK
        Created = status.HTTP_201_CREATED
        NoContent = status.HTTP_204_NO_CONTENT
        BadRequest = status.HTTP_400_BAD_REQUEST
        Unauthorized = status.HTTP_401_UNAUTHORIZED
        Forbidden = status.HTTP_403_FORBIDDEN
        NotFound = status.HTTP_404_NOT_FOUND
        InternalServerError = status.HTTP_500_INTERNAL_SERVER_ERROR

    @staticmethod
    def get_status_code(error_code: int):
        """에러 코드의 범위를 분석하여 적절한 HTTP Status 반환"""
        if error_code == ResponseCode.ErrorCode.Success:
            return ResponseCode.HttpStatusCode.Success
        if 150 <= error_code < 200:
            return ResponseCode.HttpStatusCode.NotFound
        if 200 <= error_code < 300:
            return ResponseCode.HttpStatusCode.Unauthorized
        return ResponseCode.HttpStatusCode.BadRequest