# Packets

> Packets are seperated to 2 thing, packet name and args. </br>
> Example: PacketName > getWalletData/WOWAKAFIWALLET < Args</br>
> To seperate args you can use | for seperating. </br>
> Also, every packet must end with && due to nature of TCP they can mixed.

## getWalletData/WalletAddress

Returns data of given wallet, eg: balance. </br>
Example sended data: ``walletData/{balance: 100}&&``

## getLastHash

Returns last hash of blockchain. </br>
Example sended data: ``lastHash/{hash: WQEQWEQWEQWEQWE}&&``

## getBlockByHash/Hash

Returns block of given hash. </br>
Example sended data: ``Block/{blockData}&&``

## newTransaction/Sender|Receiver|Amount|Signature|createdAt

Creates a transaction. </br>
Example sended data: ``transactionSuccess&&``