FROM alpine:3.19
RUN apk add --no-cache libc6-compat
WORKDIR /chaincode
COPY unified_ccaas .
ENV CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999
EXPOSE 9999
CMD ["./unified_ccaas"]
