FROM offchainlabs/nitro-node:v3.2.1-d81324d AS nitro-node
USER root
COPY ./bin /usr/local/bin
RUN chmod +x /usr/local/bin/*
COPY ./machines/latest /home/user/target/machines/latest
USER user
WORKDIR /home/user/
ENTRYPOINT [ "/usr/local/bin/nitro" ]

