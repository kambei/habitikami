# Keep widget provider
-keep class dev.kambei.habitikami.widget.** { *; }

# Tink (pulled in by androidx.security:security-crypto) references JSR-305
# annotations that are compile-time only and not shipped at runtime.
-dontwarn javax.annotation.Nullable
-dontwarn javax.annotation.concurrent.GuardedBy
