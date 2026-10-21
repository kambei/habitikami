package dev.kambei.habitikami.widget

import java.io.IOException

/** HTTP error from the Habitikami API; the status code drives the widget message. */
class ApiException(val code: Int) : IOException("HTTP $code")

/** Outcome of an API call, so widgets can tell "wrong key" from "offline". */
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class HttpError(val code: Int) : ApiResult<Nothing>()
    data class NetworkError(val cause: Throwable) : ApiResult<Nothing>()
}

/** Runs an API call and maps its failures to [ApiResult]. */
inline fun <T> apiCall(block: () -> T): ApiResult<T> = try {
    ApiResult.Success(block())
} catch (e: ApiException) {
    ApiResult.HttpError(e.code)
} catch (e: IOException) {
    ApiResult.NetworkError(e)
}
