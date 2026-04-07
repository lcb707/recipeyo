# common/utils.py
from rest_framework.response import Response
from .response_code import ResponseCode


class ResponseMaker:
    """
    프로젝트 전역 공통 응답 포맷:
    {
        "status": "success" | "error",
        "data": ...,
        "message": "..."
    }
    """

    @staticmethod
    def success_response(message: str = None, result: any = None, status_code: int = None):
        response_body = {
            "status": "success",
            "data": result,
            "message": message or "Success to execute request.",
        }
        http_status = status_code or ResponseCode.HttpStatusCode.Success
        return Response(response_body, status=http_status)

    @staticmethod
    def error_response(
        error_code: int = None,
        message: str = "",
        result: any = None,
        status_code: int = None,
    ):
        # 에러 코드가 있으면 data 안에 포함
        data = result
        if data is None and error_code is not None:
            data = {"error_code": error_code}

        http_status = status_code
        if http_status is None:
            # error_code 기준으로 HTTP Status 매핑
            http_status = ResponseCode.get_status_code(error_code) if error_code is not None else 400

        response_body = {
            "status": "error",
            "data": data,
            "message": message,
        }
        return Response(response_body, status=http_status)

    @staticmethod
    def success_list_response(curr_page: int, page_length: int, total_count: int, result: list):
        response_body = {
            "status": "success",
            "data": {
                "pagination": {
                    "page": curr_page,
                    "length": page_length,
                    "total_count": total_count,
                },
                "items": result,
            },
            "message": "Success to get list",
        }
        return Response(response_body, status=ResponseCode.HttpStatusCode.Success)