FROM amazonlinux:2

RUN yum update -y && yum upgrade -y

RUN curl -sL https://rpm.nodesource.com/setup_16.x | bash -
RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo -o /etc/yum.repos.d/yarn.repo

RUN yum install -y nodejs awscli yarn jq java-1.8.0-openjdk

COPY . /
WORKDIR /
RUN chmod +x run-tests.sh

RUN cd /lambdas && yarn install

ENTRYPOINT ["/run-tests.sh"]
