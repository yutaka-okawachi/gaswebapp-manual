param(
  [Parameter(Mandatory=$true)][int]$v,
  [string]$d = "rollout"
)

$ID = "AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw"

clasp push
clasp version $d
clasp deploy -i $ID -v $v -d $d
