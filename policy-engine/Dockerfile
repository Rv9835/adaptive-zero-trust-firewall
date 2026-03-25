FROM openpolicyagent/opa:latest

# Copy policies and data
COPY policies/ /policies/
COPY data/ /data/

# Expose OPA API port
EXPOSE 8181

# Run OPA server with policies loaded
ENTRYPOINT ["opa", "run", "--server", \
    "--addr", ":8181", \
    "--log-level", "info", \
    "--set", "decision_logs.console=true", \
    "/policies/", "/data/"]
