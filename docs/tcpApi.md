# Packets

````
Packets are separated into 2 things; packet name and args.
Example: PacketName > getWalletData/WOWAKAFIWALLET < Args
To separate args you can use | for seperating.
Also, every packet must end with && due to nature of TCP.
````

## getWalletData/WalletAddress

Returns data of given wallet, eg: balance. </br>
Example: ``walletData/100&&``

## getLastHash

Returns last hash of blockchain. </br>
Example: ``lastHash/WQEQWEQWEQWEQWE&&``

## getBlockByHash/Hash

Returns block of given hash. </br>
Example: ``Block/{blockData}&&``

## newTransaction/Sender|Receiver|Amount|Signature|createdAt

Creates a transaction. </br>
Example: ``transactionSuccess&&``
