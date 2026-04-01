FROM alpine:3.19
ARG TARGETARCH
RUN apk add --no-cache libstdc++ libgcc
WORKDIR /app

COPY mantle-linux-${TARGETARCH} /app/mantle
RUN chmod +x /app/mantle

EXPOSE 8080
ENTRYPOINT ["/app/mantle"]
