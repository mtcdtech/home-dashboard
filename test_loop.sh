for i in {1..20}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://home.server.mtcd.org/api/sync/workspace?id=test&token=test")
    if [ "$STATUS" != "307" ]; then
        echo "MTCD is ready: $STATUS"
        break
    fi
    sleep 2
done

for i in {1..20}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://home.abraham16.com/api/sync/workspace?id=test&token=test")
    if [ "$STATUS" != "307" ]; then
        echo "Abraham is ready: $STATUS"
        break
    fi
    sleep 2
done
