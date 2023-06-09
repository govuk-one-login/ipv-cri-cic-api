FROM ubuntu:latest

RUN apt update -y && apt upgrade -y
RUN apt install -y curl

RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt install -y nodejs
COPY . /
WORKDIR /
RUN chmod +x run-tests.sh

RUN cd /src && npm ci

ENTRYPOINT ["/run-tests.sh"]
