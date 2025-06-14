
<?php
exec("/bin/bash  ./cron_keep_node_server_alive.sh  2>&1", $out, $result);
echo "Returncode: " .$result ."<br>";
echo "Ausgabe des Scripts: " ."<br>";
echo "<pre>"; print_r($out);
?>
