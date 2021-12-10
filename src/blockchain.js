/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require("crypto-js/sha256");
const BlockClass = require("./block.js");
const bitcoinMessage = require("bitcoinjs-message");
const bitcoinLib = require('bitcoinjs-lib');
const Promise = require('bluebird');

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: "Genesis Block" });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve, reject) => {
      resolve(this.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        if (self.height != -1) {
          block.previousBlockHash = this.chain[this.chain.length - 1].hash;
        }
        self.height += 1;
        block.height = self.height;
        block.time = new Date().getTime().toString().slice(0, -3);
        block.hash = SHA256(JSON.stringify(block)).toString();
        this.chain.push(block);
        await this.validateChain();
        resolve(true);
      } catch (error) {
        const isValidateChainError =
          Array.isArray(error) &&
          error.some((er) => er.includes("validateChain:"));
        if (isValidateChainError) this.chain.pop();
        reject(error);
      }
    });
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve) => {
      resolve(
        `${address}:${new Date()
          .getTime()
          .toString()
          .slice(0, -3)}:starRegistry`
      );
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      const messageTime = parseInt(message.split(":")[1]);
      const currentTime = parseInt(
        new Date().getTime().toString().slice(0, -3)
      );
      let timeDiffBetweenMessageTimeAndCurrTime = currentTime - messageTime;

      timeDiffBetweenMessageTimeAndCurrTime /= 1000;
      const timeDiffInSeconds = Math.round(timeDiffBetweenMessageTimeAndCurrTime % 60);

      if (timeDiffInSeconds < 300) {
        let signatureMatchesMessage;
        if(!signature) {
            var keyPair = bitcoinLib.ECPair.fromWIF(address, bitcoinLib.networks.testnet)
            console.log("KEY PAIR:", keyPair);
        } else {
            signatureMatchesMessage = bitcoinMessage.verify(
              message,
              address,
              signature
            );
        }
        console.log("signatureMatchesMessage:", signatureMatchesMessage)
        if (signatureMatchesMessage) {
          const block = new BlockClass.Block({data: {star, message}});
          resolve(self._addBlock(block));
        } else {
          reject(new Error(`Signature was not valid.`));
        }
      } else {
        reject(new Error(`The star was submitted longer than 5 minutes ago.`));
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let self = this;
    return new Promise((resolve, reject) => {
      const blockFound = self.chain.find((block) => block.hash == hash);
      if (blockFound) resolve(blockFound);
      reject("Error: Block not found");
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(hash) {
    let self = this;
    return new Promise((resolve, reject) => {
      let block = self.chain.filter((p) => p.hash === hash);
      if (block.length) {
        resolve(block[0]);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let self = this;
    let stars = [];
    return new Promise((resolve, reject) => {
      return Promise.each(self.chain, async (bl) => {
        if(bl.previousBlockHash) {
          const bData = await bl.getBData();
          console.log('Block Data:', bData);
          if (bData.data && bData.data.message && bData.data.message.split(":")[0] == address) stars.push(bData);
        }
      })
      .then(_ => resolve(stars));
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  validateChain() {
    let self = this;
    let errorLog = [];
    return new Promise(async (resolve, reject) => {
      self.chain.forEach(async (bl, blIdx) => {
        try {
            console.log("BLOCK INDEX:", blIdx);
            console.log("BLOCK:", bl);
          if (blIdx != 0) {
            if (!bl.previousBlockHash)
              errorLog.push(
                `validateChain:Block with a hash of ${bl.hash} does not have a previousBlockHash`
              );
          }
          const isBlockValid = await bl.validate();
          if (!isBlockValid) errorLog.push(`validateChain:Block is not valid`);
        } catch (error) {
          errorLog.push(error);
        }
      });
      if (errorLog.length) reject(errorLog);
      else resolve("No errors found in chain.");
    });
  }
}

module.exports.Blockchain = Blockchain;
