## Packets

### Packets are seperated to 2 thing, packet name and args. </br>
### Example: PacketName > getWalletData/WOWAKAFIWALLET < Args</br>
### To seperate args you can use | for seperating. </br>
### Also, every packet must end with && due to nature of TCP they can mixed.

#### getWalletData/

This function also returns a `Promise`, with `item` as its argument upon completion.

 * `callback(err, item)`